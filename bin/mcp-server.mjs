#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

function loadEnvFiles(rootDir = ROOT) {
  const envCandidates = [
    join(process.env.HOME || "/home/stavan", ".omniroute", ".env"),
    join(rootDir, ".env"),
  ];
  for (const envFile of envCandidates) {
    if (existsSync(envFile)) {
      try {
        const lines = readFileSync(envFile, "utf8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const eq = trimmed.indexOf("=");
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            const val = trimmed
              .slice(eq + 1)
              .trim()
              .replace(/^["']|["']$/g, "");
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      } catch {}
    }
  }
}

/**
 * @param {string} [rootDir] - project root directory (defaults to package root)
 * @param {(path: string) => boolean} [existsSyncFn] - injectable fs.existsSync
 *   for testing; defaults to the real existsSync
 * @returns {string|null} resolved absolute path to the MCP server entry, or null
 */
export function resolveMcpEntry(rootDir = ROOT, existsSyncFn = existsSync) {
  const candidates = [
    // Preferred distributable JS entry (npm publish artifact, built by prepublish.ts)
    join(rootDir, "dist", "open-sse", "mcp-server", "server.js"),
    // Local workspace TypeScript source fallback
    join(rootDir, "open-sse", "mcp-server", "server.ts"),
  ];

  for (const entry of candidates) {
    if (existsSyncFn(entry)) return entry;
  }
  return null;
}

function formatSpawnError(exitCode, signal) {
  if (signal) return `MCP server exited by signal ${signal}`;
  return `MCP server exited with code ${exitCode ?? 1}`;
}

export async function startMcpCli(rootDir = ROOT) {
  loadEnvFiles(rootDir);
  const mcpEntry = resolveMcpEntry(rootDir);
  if (!mcpEntry) {
    throw new Error(
      "MCP server entrypoint not found. Expected dist/open-sse/mcp-server/server.js or open-sse/mcp-server/server.ts."
    );
  }

  // `tsx` loader is only required for local `.ts` fallback; JS entry works without it.
  const tsxLoaderArgs = mcpEntry.endsWith(".ts") ? ["--import", "tsx"] : [];
  // Preload the stdout/stderr console guard before mcpEntry's own module graph evaluates —
  // DB init (a side effect of createMcpServer()'s tool registration) logs via plain
  // console.log, and by the time any code inside mcpEntry itself could redirect it, that
  // module's own (hoisted) imports have already run. Loading the guard first, in a separate
  // module, is the only point early enough to guarantee it never leaks into the JSON-RPC
  // stream on stdout.
  const consoleGuard = pathToFileURL(join(__dirname, "mcpStdioConsoleGuard.mjs")).href;
  const loaderArgs = ["--import", consoleGuard, ...tsxLoaderArgs];

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...loaderArgs, mcpEntry], {
      cwd: rootDir,
      env: process.env,
      stdio: "inherit",
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if ((code ?? 0) === 0 && !signal) {
        resolve(undefined);
        return;
      }
      reject(new Error(formatSpawnError(code, signal)));
    });
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startMcpCli().catch((err) => {
    console.error("\x1b[31m✖ Failed to start MCP server:\x1b[0m", err?.message || err);
    process.exit(1);
  });
}
