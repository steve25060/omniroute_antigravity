#!/usr/bin/env node
/**
 * OmniRoute Antigravity Bridge Proxy
 *
 * Intercepts Antigravity CLI and IDE requests:
 * - Directs Gemini 3.8 models directly to Google backend (100% native, untouched).
 * - Directs other models (Claude Sonnet 4.5/4.6, Opus, Gemini 3.7, GPT-OSS, etc.) to OmniRoute /v1/antigravity.
 * - Passes all non-model Google requests (auth, onboarding, telemetry) directly to Google backend.
 * - Transparently forwards all other non-target internet traffic.
 */

import net from "node:net";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import fs from "node:fs";
import path from "node:path";

const PORT = parseInt(process.env.BRIDGE_PORT || "20129", 10);
const ROUTER_URL = process.env.ROUTER_URL || "http://127.0.0.1:20128/v1/antigravity";
const ROUTER_API_KEY =
  process.env.ROUTER_API_KEY || process.env.OMNIROUTE_API_KEY || "sk-omniroute-bridge-local";

// Connection pool agents with TCP keep-alive
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 120000,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 64,
  maxFreeSockets: 16,
  timeout: 120000,
});

const CERT_DIR =
  process.env.CERT_DIR || path.join(process.env.HOME || process.cwd(), ".omniroute", "mitm");
const SERVER_KEY = path.join(CERT_DIR, "server.key");
const SERVER_CRT = path.join(CERT_DIR, "server.crt");

if (!fs.existsSync(SERVER_KEY) || !fs.existsSync(SERVER_CRT)) {
  console.error("❌ Certificate files not found in", CERT_DIR);
  process.exit(1);
}

const sslOptions = {
  key: fs.readFileSync(SERVER_KEY),
  cert: fs.readFileSync(SERVER_CRT),
};

const TARGET_HOSTS = new Set([
  "cloudcode-pa.googleapis.com",
  "daily-cloudcode-pa.googleapis.com",
  "daily-cloudcode-pa.sandbox.googleapis.com",
  "autopush-cloudcode-pa.sandbox.googleapis.com",
  "preprod-daily-cloudcode-pa.sandbox.googleapis.com",
  "antigravity-unleash.goog",
]);

function isGenerationRequest(url) {
  if (!url) return false;
  return (
    url.includes(":generateContent") ||
    url.includes(":streamGenerateContent") ||
    url.includes("/GenerateChat") ||
    url.includes("/StreamGenerateChat") ||
    url.includes("/GenerateCode") ||
    url.includes("/CompleteCode")
  );
}

function extractModel(body, url) {
  if (body && typeof body === "object") {
    if (typeof body.model === "string" && body.model) return body.model;
    if (body.request && typeof body.request.model === "string" && body.request.model) {
      return body.request.model;
    }
  }
  if (url) {
    try {
      const parsed = new URL(url, "https://cloudcode-pa.googleapis.com");
      const m = parsed.searchParams.get("model");
      if (m) return m;
    } catch {}
  }
  return null;
}

const OMNIROUTE_CUSTOM_MODELS = new Set([
  "coding-titans",
  "speed-demons",
  "infinite-context",
  "zero-cost-fallback",
  "gpt-6-astra",
  "gpt-6-astra-ultra",
  "gpt-6-astra-max",
  "gpt-6-astra-high",
  "gpt-6-astra-medium",
  "gpt-6-astra-low",
  "gpt-5.6-sol",
  "gpt-5.6-sol-ultra",
  "gpt-5.6-sol-max",
  "gpt-5.6-sol-high",
  "gpt-5.6-sol-medium",
  "gpt-5.6-sol-low",
  "gpt-5.6-terra",
  "gpt-5.6-terra-ultra",
  "gpt-5.6-terra-max",
  "gpt-5.6-terra-high",
  "gpt-5.6-terra-medium",
  "gpt-5.6-terra-low",
  "gpt-5.6-luna",
  "gpt-5.6-luna-max",
  "gpt-5.6-luna-high",
  "gpt-5.6-luna-medium",
  "gpt-5.6-luna-low",
  "gpt-5.5",
  "gpt-5.5-xhigh",
  "gpt-5.5-high",
  "gpt-5.5-medium",
  "gpt-5.5-low",
  "gpt-5.3-codex-spark",
]);

function shouldInterceptToOmniRoute(model, url) {
  if (!model) return false;

  // Never intercept non-streaming unary RPCs (Antigravity expects raw JSON/Protobuf, not SSE)
  const isStreaming =
    url.includes("streamGenerateContent") ||
    url.includes("StreamGenerateChat") ||
    url.includes("alt=sse");
  if (!isStreaming) return false;

  // Never intercept native Google/Gemini models (used by Antigravity core, subagents, websearch, grounding)
  if (model.startsWith("gemini-") || model.startsWith("models/gemini-")) {
    return false;
  }

  // Never intercept native Google CloudCode PA hosted models
  if (
    model === "claude-sonnet-4-6" ||
    model === "claude-opus-4-6" ||
    model === "gpt-oss-120b-medium"
  ) {
    return false;
  }

  // Intercept explicit custom OmniRoute combos
  if (OMNIROUTE_CUSTOM_MODELS.has(model)) {
    return true;
  }

  // Intercept custom OpenAI Codex models
  if (model.startsWith("gpt-")) {
    return true;
  }

  return false;
}

// Internal HTTP server that receives decrypted requests for TARGET_HOSTS
const internalApp = http.createServer(async (req, res) => {
  const host = (req.headers.host || "cloudcode-pa.googleapis.com").split(":")[0];
  const url = req.url || "/";

  // Collect request body
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const bodyBuffer = Buffer.concat(chunks);

  let bodyJson = null;
  if (bodyBuffer.length > 0) {
    try {
      bodyJson = JSON.parse(bodyBuffer.toString("utf-8"));
    } catch {}
  }

  const model = extractModel(bodyJson, url);
  const shouldIntercept = shouldInterceptToOmniRoute(model, url);

  if (shouldIntercept) {
    console.log(`[Bridge] 🔀 INTERCEPTING -> OmniRoute: ${model || "default"} (${url})`);

    // Forward to OmniRoute /v1/antigravity
    try {
      const forwardHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ROUTER_API_KEY}`,
        "x-omniroute-source": "agent-bridge",
        "x-omniroute-agent": "antigravity",
        "x-omniroute-skip-usage": "true", // Skip usage tracking for default models
      };

      const upstreamReq = http.request(
        ROUTER_URL,
        {
          method: "POST",
          headers: forwardHeaders,
          agent: httpAgent,
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode || 200, upstreamRes.headers);
          upstreamRes.pipe(res);
        }
      );
      upstreamReq.setNoDelay(true);

      upstreamReq.on("error", (err) => {
        console.error(`[Bridge] ❌ Error forwarding to OmniRoute: ${err.message}`);
        if (!res.headersSent) {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: { message: `OmniRoute bridge error: ${err.message}` } }));
        }
      });

      upstreamReq.write(bodyBuffer);
      upstreamReq.end();
      return;
    } catch (err) {
      console.error(`[Bridge] ❌ Failed to invoke OmniRoute: ${err.message}`);
    }
  }

  // Otherwise: Passthrough directly to Google upstream
  console.log(`[Bridge] ⏩ PASSTHROUGH -> Google: ${model || "non-model"} (${url})`);

  const upstreamHeaders = { ...req.headers };
  delete upstreamHeaders["host"]; // Let https.request set the correct Host
  upstreamHeaders["host"] = host;

  if (url.includes("fetchAvailableModels")) {
    delete upstreamHeaders["accept-encoding"];
  }

  const googleReq = https.request(
    {
      hostname: host,
      port: 443,
      path: url,
      method: req.method,
      headers: upstreamHeaders,
      agent: httpsAgent,
    },
    (googleRes) => {
      if (url.includes("fetchAvailableModels")) {
        const respChunks = [];
        googleRes.on("data", (chunk) => respChunks.push(chunk));
        googleRes.on("end", () => {
          const respBuffer = Buffer.concat(respChunks);
          let finalBuffer = respBuffer;
          try {
            const data = JSON.parse(respBuffer.toString("utf-8"));
            if (data && data.models) {
              // Inject custom OmniRoute models
              if (data.models["claude-sonnet-4-6"]) {
                data.models["coding-titans"] = {
                  ...data.models["claude-sonnet-4-6"],
                  displayName: "Coding Titans (Codestral / Nemotron)",
                  descriptionText:
                    "OmniRoute Deep Architecture, Heavy Refactoring, and Logic Reasoning",
                };
              }
              if (data.models["gemini-3.7-flash-medium"]) {
                data.models["speed-demons"] = {
                  ...data.models["gemini-3.7-flash-medium"],
                  displayName: "Speed Demons (Ultra Fast / Sub-second)",
                  descriptionText: "OmniRoute Sub-second Daily Coding & Fast Iteration",
                };
              }
              if (data.models["gemini-3.6-flash-high"]) {
                data.models["infinite-context"] = {
                  ...data.models["gemini-3.6-flash-high"],
                  displayName: "Infinite Context (Massive 1M+ Repo)",
                  descriptionText: "OmniRoute Repository-Wide Ingestion & Long Context",
                };
              }
              if (data.models["gpt-oss-120b-medium"]) {
                data.models["zero-cost-fallback"] = {
                  ...data.models["gpt-oss-120b-medium"],
                  displayName: "Zero-Cost Fallback (Unmetered Free)",
                  descriptionText: "OmniRoute 100% Free Unmetered Safety Net Fallback",
                };
              }

              if (data.models["claude-sonnet-4-6"]) {
                const baseTemplate = data.models["claude-sonnet-4-6"];
                const codexList = [
                  { id: "gpt-6-astra", name: "GPT 6 Astra" },
                  { id: "gpt-6-astra-ultra", name: "GPT 6 Astra (Ultra)" },
                  { id: "gpt-6-astra-max", name: "GPT 6 Astra (Max)" },
                  { id: "gpt-6-astra-high", name: "GPT 6 Astra (High)" },
                  { id: "gpt-6-astra-medium", name: "GPT 6 Astra (Medium)" },
                  { id: "gpt-6-astra-low", name: "GPT 6 Astra (Low)" },
                  { id: "gpt-5.6-sol", name: "GPT 5.6 Sol" },
                  { id: "gpt-5.6-sol-ultra", name: "GPT 5.6 Sol (Ultra)" },
                  { id: "gpt-5.6-sol-max", name: "GPT 5.6 Sol (Max)" },
                  { id: "gpt-5.6-sol-high", name: "GPT 5.6 Sol (High)" },
                  { id: "gpt-5.6-sol-medium", name: "GPT 5.6 Sol (Medium)" },
                  { id: "gpt-5.6-sol-low", name: "GPT 5.6 Sol (Low)" },
                  { id: "gpt-5.6-terra", name: "GPT 5.6 Terra" },
                  { id: "gpt-5.6-terra-ultra", name: "GPT 5.6 Terra (Ultra)" },
                  { id: "gpt-5.6-terra-max", name: "GPT 5.6 Terra (Max)" },
                  { id: "gpt-5.6-terra-high", name: "GPT 5.6 Terra (High)" },
                  { id: "gpt-5.6-terra-medium", name: "GPT 5.6 Terra (Medium)" },
                  { id: "gpt-5.6-terra-low", name: "GPT 5.6 Terra (Low)" },
                  { id: "gpt-5.6-luna", name: "GPT 5.6 Luna" },
                  { id: "gpt-5.6-luna-max", name: "GPT 5.6 Luna (Max)" },
                  { id: "gpt-5.6-luna-high", name: "GPT 5.6 Luna (High)" },
                  { id: "gpt-5.6-luna-medium", name: "GPT 5.6 Luna (Medium)" },
                  { id: "gpt-5.6-luna-low", name: "GPT 5.6 Luna (Low)" },
                  { id: "gpt-5.5", name: "GPT 5.5" },
                  { id: "gpt-5.5-xhigh", name: "GPT 5.5 (xHigh)" },
                  { id: "gpt-5.5-high", name: "GPT 5.5 (High)" },
                  { id: "gpt-5.5-medium", name: "GPT 5.5 (Medium)" },
                  { id: "gpt-5.5-low", name: "GPT 5.5 (Low)" },
                  { id: "gpt-5.3-codex-spark", name: "GPT 5.3 Codex Spark" },
                ];

                for (const cm of codexList) {
                  data.models[cm.id] = {
                    ...baseTemplate,
                    displayName: `Codex: ${cm.name}`,
                    descriptionText: `OpenAI Codex CLI Model (${cm.name}) routed through OmniRoute`,
                  };
                }
              }

              // Prepend custom models to agentModelSorts recommended group
              if (
                Array.isArray(data.agentModelSorts) &&
                data.agentModelSorts[0]?.groups?.[0]?.modelIds
              ) {
                const customIds = [
                  "coding-titans",
                  "speed-demons",
                  "infinite-context",
                  "zero-cost-fallback",
                  "gpt-6-astra",
                  "gpt-6-astra-ultra",
                  "gpt-6-astra-max",
                  "gpt-6-astra-high",
                  "gpt-6-astra-medium",
                  "gpt-6-astra-low",
                  "gpt-5.6-sol",
                  "gpt-5.6-sol-ultra",
                  "gpt-5.6-sol-max",
                  "gpt-5.6-sol-high",
                  "gpt-5.6-sol-medium",
                  "gpt-5.6-sol-low",
                  "gpt-5.6-terra",
                  "gpt-5.6-terra-ultra",
                  "gpt-5.6-terra-max",
                  "gpt-5.6-terra-high",
                  "gpt-5.6-terra-medium",
                  "gpt-5.6-terra-low",
                  "gpt-5.6-luna",
                  "gpt-5.6-luna-max",
                  "gpt-5.6-luna-high",
                  "gpt-5.6-luna-medium",
                  "gpt-5.6-luna-low",
                  "gpt-5.5",
                  "gpt-5.5-xhigh",
                  "gpt-5.5-high",
                  "gpt-5.5-medium",
                  "gpt-5.5-low",
                  "gpt-5.3-codex-spark",
                ];
                const existing = data.agentModelSorts[0].groups[0].modelIds;
                data.agentModelSorts[0].groups[0].modelIds = [
                  ...customIds,
                  ...existing.filter((id) => !customIds.includes(id)),
                ];
              }

              finalBuffer = Buffer.from(JSON.stringify(data), "utf-8");
              console.log(
                `[Bridge] 🌟 Injected custom models into fetchAvailableModels (${finalBuffer.length} bytes)`
              );
            }
          } catch (err) {
            console.error(`[Bridge] ⚠️ Error modifying fetchAvailableModels: ${err.message}`);
          }

          const headers = { ...googleRes.headers };
          delete headers["content-length"];
          delete headers["content-encoding"];
          headers["content-length"] = String(finalBuffer.length);
          res.writeHead(googleRes.statusCode || 200, headers);
          res.end(finalBuffer);
        });
        return;
      }

      res.writeHead(googleRes.statusCode || 200, googleRes.headers);
      googleRes.pipe(res);
    }
  );
  googleReq.setNoDelay(true);

  googleReq.on("error", (err) => {
    console.error(`[Bridge] ❌ Google upstream error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: `Google upstream error: ${err.message}` } }));
    }
  });

  if (bodyBuffer.length > 0) {
    googleReq.write(bodyBuffer);
  }
  googleReq.end();
});

internalApp.keepAliveTimeout = 65000;
internalApp.headersTimeout = 66000;

// Proxy server listening on HTTP port
const proxyServer = http.createServer((req, res) => {
  // Plain HTTP request (non-CONNECT)
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("OmniRoute Antigravity Bridge Proxy Active\n");
});

proxyServer.keepAliveTimeout = 65000;
proxyServer.headersTimeout = 66000;

proxyServer.on("connect", (req, clientSocket, head) => {
  clientSocket.setNoDelay(true);
  const [targetHost, targetPortStr] = (req.url || "").split(":");
  const targetPort = parseInt(targetPortStr || "443", 10);

  if (TARGET_HOSTS.has(targetHost)) {
    // Target host: Terminate TLS locally and route via internalApp
    clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");

    const tlsSocket = new tls.TLSSocket(clientSocket, {
      isServer: true,
      key: sslOptions.key,
      cert: sslOptions.cert,
    });
    tlsSocket.setNoDelay(true);

    tlsSocket.on("error", (err) => {
      // Client closed or TLS error
      clientSocket.destroy();
    });

    internalApp.emit("connection", tlsSocket);
  } else {
    // Non-target host: Transparent raw TCP tunnel
    const upstreamSocket = net.connect(targetPort, targetHost, () => {
      upstreamSocket.setNoDelay(true);
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head && head.length > 0) {
        upstreamSocket.write(head);
      }
      upstreamSocket.pipe(clientSocket);
      clientSocket.pipe(upstreamSocket);
    });

    const cleanup = () => {
      clientSocket.destroy();
      upstreamSocket.destroy();
    };

    upstreamSocket.on("error", cleanup);
    clientSocket.on("error", cleanup);
  }
});

proxyServer.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 OmniRoute Antigravity Bridge listening on 127.0.0.1:${PORT}`);
  console.log(`   Routing non-Gemini 3.8 model traffic -> ${ROUTER_URL}`);
  console.log(`   Preserving Gemini 3.8 native traffic -> Google`);
});
