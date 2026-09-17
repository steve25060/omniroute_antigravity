import fs from "node:fs";
import path from "node:path";
// Load environment from ~/.omniroute/.env and repo .env
const homeEnvPath = path.join(process.env.HOME || process.cwd(), ".omniroute", ".env");
const repoEnvPath = path.join(process.cwd(), ".env");

function loadEnv(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv(homeEnvPath);
loadEnv(repoEnvPath);

import { getDbInstance } from "../../src/lib/db/core";
import { updateSettings, getSettings } from "../../src/lib/db/settings";
import { createApiKey, getApiKeys } from "../../src/lib/db/apiKeys";
import { getMachineId } from "../../src/shared/utils/machine";
import { updateCompressionSettings, getCompressionSettings } from "../../src/lib/db/compression";
import { assignRoutingCombo, listCompressionCombos } from "../../src/lib/db/compressionCombos";

async function main() {
  console.log("=== Configuring OmniRoute Master Settings & Unlimited Token Stack ===");

  // 1. Enable MCP Server
  console.log("[1/6] Updating Settings: enabling MCP server...");
  await updateSettings({
    mcpEnabled: true,
    mcpTransport: "stdio",
  });
  const currentSettings = await getSettings();
  console.log(
    `  ✓ MCP Enabled: ${currentSettings.mcpEnabled}, Transport: ${currentSettings.mcpTransport}`
  );

  // 2. Configure API Key
  console.log("[2/6] Checking / Creating OmniRoute Master Admin API Key...");
  let masterKey = "";
  const existingKeys = await getApiKeys();
  const found = existingKeys.find(
    (k: any) => k.name === "Antigravity Master Key" || k.scopes?.includes("admin")
  );

  if (found) {
    masterKey = found.key;
    console.log(
      `  ✓ Found existing Master API key: ${found.name} (prefix: ${found.key.slice(0, 14)}...)`
    );
  } else {
    const machineId = await getMachineId();
    const created = await createApiKey(
      "Antigravity Master Key",
      machineId,
      ["admin", "manage", "mcp:connect", "read", "write"],
      {
        modelAccessMode: "all",
        allowedCombos: ["*"],
      }
    );
    masterKey = created.key;
    console.log(`  ✓ Generated NEW Master API key: ${created.name} (${masterKey.slice(0, 14)}...)`);
  }

  // 3. Configure Unlimited Token Compression Stack
  console.log("[3/6] Configuring Unlimited Token Compression Stack (RTK + Caveman)...");
  await updateCompressionSettings({
    enabled: true,
    defaultMode: "stacked",
    activeComboId: "default-caveman",
    stackedPipeline: [
      { engine: "rtk", intensity: "standard" },
      { engine: "caveman", intensity: "full" },
    ],
    rtkConfig: {
      enabled: true,
      intensity: "standard",
    },
    cavemanConfig: {
      enabled: true,
      intensity: "full",
      compressRoles: ["user"],
      skipRules: [],
      minMessageLength: 50,
      preservePatterns: [],
    },
    preserveSystemPrompt: true,
    engines: {
      rtk: { enabled: true, level: "standard" },
      caveman: { enabled: true, level: "full" },
    },
  });
  const compSettings = await getCompressionSettings();
  console.log(
    `  ✓ Global Compression Enabled: ${compSettings.enabled}, Mode: ${compSettings.defaultMode}`
  );

  // 4. Assign default-caveman compression to all routing combos
  console.log("[4/6] Binding RTK + Caveman compression to all 4 model combos...");
  const combosToAssign = [
    { name: "coding-titans", id: "a48c2a4d-2dad-47d1-99e0-2f760ef0f5e0" },
    { name: "speed-demons", id: "988e54ff-d5e0-4ca4-81fd-8f69de9712eb" },
    { name: "infinite-context", id: "46d93a42-bb53-46d1-8540-d483a02761dc" },
    { name: "zero-cost-fallback", id: "be051731-3335-4779-b200-e979b7e6b7ae" },
  ];

  for (const c of combosToAssign) {
    assignRoutingCombo("default-caveman", c.name);
    assignRoutingCombo("default-caveman", c.id);
    console.log(`  ✓ Assigned RTK+Caveman pipeline to combo: ${c.name} (${c.id})`);
  }

  // 5. Update .env files with OMNIROUTE_API_KEY
  console.log("[5/6] Writing OMNIROUTE_API_KEY to environment files...");
  function updateEnvFile(filePath: string, keyVal: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, "utf8");
    if (content.includes("OMNIROUTE_API_KEY=")) {
      content = content.replace(/OMNIROUTE_API_KEY=.*/g, `OMNIROUTE_API_KEY=${keyVal}`);
    } else {
      content += `\nOMNIROUTE_API_KEY=${keyVal}\n`;
    }
    fs.writeFileSync(filePath, content, { mode: 0o600 });
    console.log(`  ✓ Updated ${filePath}`);
  }

  updateEnvFile(homeEnvPath, masterKey);
  updateEnvFile(repoEnvPath, masterKey);

  const homeDir = process.env.HOME || process.cwd();
  const mcpConfigFiles = [
    path.join(homeDir, ".gemini", "config", "mcp_config.json"),
    path.join(homeDir, ".config", "Antigravity IDE", "User", "mcp.json"),
    path.join(homeDir, ".claude.json"),
  ];

  for (const mcpFile of mcpConfigFiles) {
    if (!fs.existsSync(mcpFile)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(mcpFile, "utf8"));
      if (json.mcpServers?.omniroute) {
        json.mcpServers.omniroute.env = {
          ...json.mcpServers.omniroute.env,
          PORT: "20128",
          HOST: "127.0.0.1",
          OMNIROUTE_API_KEY: masterKey,
        };
        fs.writeFileSync(mcpFile, JSON.stringify(json, null, 2) + "\n");
        console.log(`  ✓ Updated MCP config with OMNIROUTE_API_KEY: ${mcpFile}`);
      }
    } catch (e: any) {
      console.error(`  ✖ Failed to update ${mcpFile}:`, e?.message);
    }
  }

  console.log("\n✅ Master OmniRoute Configuration successfully completed!");
  console.log(`Master API Key: ${masterKey}`);
}

main().catch((err) => {
  console.error("FATAL error during master setup:", err);
  process.exit(1);
});
