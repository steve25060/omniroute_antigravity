# OmniRoute Antigravity Bridge & Model Integration Guide

This guide details the end-to-end integration of OmniRoute with Google Antigravity CLI and Antigravity IDE, enabling transparent model routing, custom model injection, and native fallback preservation.

---

## Architecture Overview

```
                          ┌────────────────────────┐
                          │    Antigravity CLI     │
                          │   / Antigravity IDE    │
                          └───────────┬────────────┘
                                      │ HTTPS
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       OmniRoute Antigravity Bridge Proxy         │
             │              (Port 20129, Localhost)             │
             └───────────────┬──────────────────┬───────────────┘
                             │                  │
        [Gemini 3.8 Native / │                  │ [Third-party Models & Custom Combos]
         Telemetry / Auth]   │                  │ (Coding Titans, Speed Demons, etc.)
                             ▼                  ▼
              ┌─────────────────────┐    ┌─────────────────────────┐
              │  Google Production  │    │     OmniRoute Server    │
              │       Backend       │    │       (Port 20128)      │
              └─────────────────────┘    └───────────┬─────────────┘
                                                     │
                                       ┌─────────────┴─────────────┐
                                       ▼                           ▼
                                ┌───────────────┐           ┌──────────────┐
                                │ NVIDIA / Groq │           │ Cerebras /   │
                                │ DeepSeek NIM  │           │ OpenRouter   │
                                └───────────────┘           └──────────────┘
```

---

## 1. Components

### A. The Antigravity Bridge Proxy (`bin/antigravity-bridge.mjs`)

- Runs as a TLS interceptor on port `20129`.
- Uses local MITM certificates (`~/.omniroute/mitm/server.key` and `server.crt`).
- **Dynamic Model Catalog Injection**:
  Intercepts `/v1internal:fetchAvailableModels` and dynamically injects:
  - `coding-titans`: Deep Architecture & Heavy Refactoring (`nemotron-3-super-120b`, `deepseek-r1`, `claude-3-7-sonnet`).
  - `speed-demons`: Sub-second coding & fast iteration (`llama-3.3-70b`, `codestral-2501`).
  - `infinite-context`: 1M+ token repository analysis (`gemini-2.5-flash`, `gemini-2.5-pro`).
  - `zero-cost-fallback`: 100% free unmetered safety net (`qwen-2.5-coder-32b:free`, `deepseek-r1:free`).
- **Selective Upstream Routing**:
  - Directs Gemini 3.8 models (`gemini-3.8*`) natively to Google backend.
  - Directs other models (Claude Sonnet 4.5/4.6, GPT-OSS, custom combos) to OmniRoute `/v1/antigravity`.
  - Passes all auth, telemetry, and non-target traffic cleanly to Google upstream.

### B. Antigravity Translator (`open-sse/translator/response/openai-to-antigravity.ts`)

- Translates OpenAI SSE chunks into the native Google Antigravity candidate and function-calling schema.
- Accumulates tool call chunks and preserves exact `id`, `name`, and `args` to ensure bash command execution and file operations succeed reliably.

### C. Systemd User Services (`deploy/systemd/`)

- `omniroute.service`: Manages the OmniRoute routing daemon on port `20128`.
- `omniroute-bridge.service`: Manages the Antigravity bridge proxy on port `20129`.

---

## 2. Installation & Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Generate MITM Certificates

```bash
mkdir -p ~/.omniroute/mitm
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout ~/.omniroute/mitm/server.key \
  -out ~/.omniroute/mitm/server.crt \
  -days 3650 \
  -subj "/CN=cloudcode-pa.googleapis.com"
```

### 3. Deploy Systemd User Daemons

```bash
cp deploy/systemd/*.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now omniroute omniroute-bridge
```

### 4. Verify Services

```bash
systemctl --user status omniroute --no-pager
systemctl --user status omniroute-bridge --no-pager
```

### 5. Launch Antigravity CLI / IDE with Proxy

```bash
export HTTPS_PROXY=http://127.0.0.1:20129
export HTTP_PROXY=http://127.0.0.1:20129
export NODE_EXTRA_CA_CERTS=~/.omniroute/mitm/server.crt
```

Inside Antigravity, type `/model` to see and select any of the injected OmniRoute combos alongside Google native models.
