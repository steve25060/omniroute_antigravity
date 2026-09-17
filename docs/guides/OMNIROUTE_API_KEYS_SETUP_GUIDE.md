# OmniRoute Master Free-Tier Provider & API Key Setup Guide

> **OmniRoute Version**: v3.8.51  
> **Target Endpoint**: `http://127.0.0.1:20128`  
> **Proxy Surface**: OpenAI-compatible `/v1/chat/completions`, `/v1/models`  
> **Auth Strategy**: High-Speed, Zero-Cost Frontier & Open-Weight LLM Redundancy

---

## Executive Summary & Strategy

OmniRoute unifies over 350 AI providers into a resilient, high-speed, local API gateway with intelligent fallback, circuit breakers, and context compression.

To achieve **maximum coding & reasoning performance with 100% zero subscription costs**, OmniRoute is paired with the **Top 7 Free-Tier Providers**. This strategic portfolio guarantees:

1. **Extreme Low Latency**: Groq & Cerebras delivering 300 to 1,800+ tokens/sec.
2. **Massive Context Windows**: Google Gemini providing up to 1,000,000 token contexts for whole-codebase comprehension.
3. **Frontier Reasoning & Coding**: DeepSeek V4 / R1, NVIDIA NIM Nemotron & Kimi, and Mistral Codestral for complex multi-file engineering.
4. **Infinite Backup & Failover**: OpenRouter's unmetered `:free` tier routing across dozens of open-source models if any primary upstream hits quota.

---

## Provider Quick-Reference Matrix

| #   | Provider             | OmniRoute ID | Category           | Direct Key Generation URL                                                | Free Tier Quota / Limits                | Primary Model Picks                                                                           |
| --- | -------------------- | ------------ | ------------------ | ------------------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **NVIDIA NIM**       | `nvidia`     | Inference Host     | [build.nvidia.com](https://build.nvidia.com)                             | 1,000 dev credits, ~40 RPM              | `nvidia/nemotron-3-super-120b-a12b`, `deepseek-ai/deepseek-v4-pro-0813`, `moonshotai/kimi-k3` |
| 2   | **Google AI Studio** | `gemini`     | Frontier Lab       | [aistudio.google.com](https://aistudio.google.com/app/apikey)            | 15 RPM, 1M TPM, 1,500 RPD               | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3.7-flash`                                      |
| 3   | **Groq Cloud**       | `groq`       | LPU Inference      | [console.groq.com/keys](https://console.groq.com/keys)                   | 30 RPM, 100K–500K tokens/day            | `llama-3.3-70b-versatile`, `meta-llama/llama-4-scout-17b-16e-instruct`                        |
| 4   | **Cerebras Cloud**   | `cerebras`   | Wafer-Scale        | [cloud.cerebras.ai](https://cloud.cerebras.ai)                           | $5 signup credit (~10M+ tokens), 30 RPM | `gpt-oss-120b`, `gemma-4-31b`, `zai-glm-4.7`                                                  |
| 5   | **Mistral AI**       | `mistral`    | Frontier Lab       | [console.mistral.ai/api-keys](https://console.mistral.ai/api-keys/)      | 1 RPS (60 RPM), 500K TPM                | `codestral-latest`, `mistral-large-latest`, `devstral-latest`                                 |
| 6   | **OpenRouter**       | `openrouter` | Gateway            | [openrouter.ai/keys](https://openrouter.ai/keys)                         | 20 RPM, 200 RPD on `:free` models       | `openrouter/auto`, `:free` models (Llama 3.3, DeepSeek R1)                                    |
| 7   | **DeepSeek**         | `deepseek`   | Frontier Reasoning | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) | 5M free tokens on signup                | `deepseek-v4-pro`, `deepseek-v4-flash`                                                        |

---

## 3 Ways to Provide Keys to OmniRoute

OmniRoute manages secrets with a security-first storage hierarchy:

### Method 1: Web Dashboard UI (Recommended for GUI)

1. Open the OmniRoute dashboard in your browser: [http://127.0.0.1:20128/dashboard/providers](http://127.0.0.1:20128/dashboard/providers)
2. Click **+ Add Provider** (or navigate to **Settings → Providers**).
3. Select your provider from the list (e.g. `NVIDIA NIM`, `Gemini`, `Groq`).
4. Paste your API Key in the **API Key** input box.
5. Click **Save & Test Connection**. OmniRoute validates the key immediately against upstream endpoints and encrypts it in SQLite at rest.

### Method 2: OmniRoute CLI (Recommended for Terminal / Automation)

OmniRoute includes built-in commands for connection management:

```bash
# General provider addition syntax
omniroute providers add <provider_id> --credential "<API_KEY>"

# Alternative using environment variable reference
omniroute providers add <provider_id> --credential-env <ENV_VAR_NAME>

# Direct key store syntax
omniroute keys add <provider_id> "<API_KEY>"

# List all configured active keys
omniroute keys list
```

### Method 3: Environment Variables in `.env` (Headless & Docker)

OmniRoute automatically reads environment variables from `/home/stavan/omniroute/.env` upon startup.

- In OmniRoute v3.8+, native fallbacks are provided for `NVIDIA_API_KEY`, `DEEPSEEK_API_KEY`, and `GEMINI_API_KEY` (alias `GOOGLE_API_KEY`).
- For providers whose static env keys were migrated into the encrypted database (`GROQ_API_KEY`, `CEREBRAS_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`), declaring them in `.env` allows one-step CLI synchronization:
  ```bash
  omniroute providers add groq --credential-env GROQ_API_KEY
  omniroute providers add cerebras --credential-env CEREBRAS_API_KEY
  omniroute providers add mistral --credential-env MISTRAL_API_KEY
  omniroute providers add openrouter --credential-env OPENROUTER_API_KEY
  ```

---

## Detailed Provider Profiles & Setup

---

### 1. NVIDIA NIM

- **OmniRoute ID**: `nvidia` (Alias: `nvidia`)
- **Category**: `inference-hosts`
- **Why Selected**: NVIDIA provides developer-tier hosted inference for world-class models on state-of-the-art DGX Cloud infrastructure. Includes specialized reasoning models, Moonshot Kimi, DeepSeek V4, and NVIDIA's custom Nemotron 3 Ultra (550B) with zero hosting costs.
- **Direct Signup URL**: [https://build.nvidia.com](https://build.nvidia.com)
  1. Sign in with your NVIDIA developer account.
  2. Navigate to [build.nvidia.com](https://build.nvidia.com) and click on any model (e.g. _Nemotron 3 Super_ or _DeepSeek V4_).
  3. Click **Get API Key** and generate a new key (prefix: `nvapi-...`).
- **Free Tier Quotas & Limits**:
  - **Dev Credits**: 1,000 free API calls/credits upon onboarding.
  - **Rate Limit**: ~40 RPM (Requests Per Minute) per model.
  - **Passthrough Multiplexing**: OmniRoute flags NVIDIA as `passthroughModels: true`, enabling seamless routing to all 70+ hosted models without cross-model error poisoning.
- **Key Models**:
  - `nvidia/nemotron-3-super-120b-a12b`
  - `nvidia/nemotron-3.5-lightning-30b-a3b`
  - `deepseek-ai/deepseek-v4-pro-0813`
  - `moonshotai/kimi-k3`
  - `google/gemma-4-31b-it`
- **Environment Variable**:
  ```bash
  NVIDIA_API_KEY=nvapi-your_nvidia_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add nvidia --credential "$NVIDIA_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "nvidia/nemotron-3-super-120b-a12b",
      "messages": [{"role": "user", "content": "Ping"}]
    }'
  ```

---

### 2. Google AI Studio (Gemini)

- **OmniRoute ID**: `gemini` (Alias: `gemini`)
- **Category**: `frontier-labs`
- **Why Selected**: Google AI Studio offers the most capable free tier among all frontier AI labs. Features native multimodal processing (text, code, images, audio, video) and an unmatched 1,000,000+ token context window.
- **Direct Signup URL**: [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
  1. Sign in with any Google account.
  2. Click **Get API key** → **Create API key in new project**.
  3. Copy the generated key (prefix: `AIzaSy...`).
- **Free Tier Quotas & Limits**:
  - **Gemini 2.5 Flash**: 15 RPM, 1,000,000 TPM, 1,500 Requests Per Day (**100% Free**).
  - **Gemini 2.5 Flash-Lite**: 15 RPM, 1,000,000 TPM, 1,500 RPD.
  - **Gemini 2.5 Pro**: 2 RPM, 32,000 TPM, 50 Requests Per Day.
  - **Context Window**: 1,048,576 tokens native context.
- **Key Models**:
  - `gemini-2.5-flash`
  - `gemini-2.5-flash-lite`
  - `gemini-2.5-pro`
  - `gemini-3.7-flash`
  - `gemini-3.1-pro-preview`
- **Environment Variable**:
  ```bash
  GEMINI_API_KEY=AIzaSy_your_gemini_key_here
  # Note: GOOGLE_API_KEY is also recognized as an alias
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add gemini --credential "$GEMINI_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "gemini/gemini-2.5-flash",
      "messages": [{"role": "user", "content": "Respond with: Gemini verified"}]
    }'
  ```

---

### 3. Groq Cloud

- **OmniRoute ID**: `groq` (Alias: `groq`)
- **Category**: `frontier-labs`
- **Why Selected**: Powered by custom LPU (Language Processing Unit) tensor silicon, Groq delivers near-instant response generation (>300 tokens per second). Essential for autocomplete, quick linting, and rapid agentic tool invocation.
- **Direct Signup URL**: [https://console.groq.com/keys](https://console.groq.com/keys)
  1. Sign in with GitHub or email.
  2. Navigate to **API Keys** in the left sidebar.
  3. Click **Create API Key**, name it `omniroute`, and copy the key (prefix: `gsk_...`).
- **Free Tier Quotas & Limits**:
  - **Rate Limits**: 30 RPM across chat models.
  - **Daily Caps**: 100,000 to 500,000 tokens/day per model family.
  - **Credit Card**: Never required for free tier.
- **Key Models**:
  - `llama-3.3-70b-versatile` (70B parameters with top-tier general coding)
  - `meta-llama/llama-4-scout-17b-16e-instruct`
  - `qwen/qwen3-32b`
- **Environment Variable**:
  ```bash
  GROQ_API_KEY=gsk_your_groq_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add groq --credential "$GROQ_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "groq/llama-3.3-70b-versatile",
      "messages": [{"role": "user", "content": "Respond with: Groq verified"}]
    }'
  ```

---

### 4. Cerebras Cloud

- **OmniRoute ID**: `cerebras` (Alias: `cerebras`)
- **Category**: `inference-hosts`
- **Why Selected**: Cerebras Wafer-Scale Engine CS-3 provides the highest tokens-per-second generation speed in the world (>1,800 tokens/sec on 8B, >450 tokens/sec on 70B models).
- **Direct Signup URL**: [https://cloud.cerebras.ai](https://cloud.cerebras.ai)
  1. Sign up for a Cerebras Cloud account.
  2. Access the **API Keys** section and click **Create Key**.
  3. Copy the secret key (prefix: `csk-...`).
- **Free Tier Quotas & Limits**:
  - **Trial Grant**: $5.00 free credit grant on signup (valid 30 days, provides millions of tokens at Cerebras's low-cost structure).
  - **Rate Limit**: 30 RPM, 60,000 TPM.
- **Key Models**:
  - `cerebras/gpt-oss-120b`
  - `cerebras/gemma-4-31b`
  - `cerebras/zai-glm-4.7`
- **Environment Variable**:
  ```bash
  CEREBRAS_API_KEY=csk_your_cerebras_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add cerebras --credential "$CEREBRAS_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "cerebras/gpt-oss-120b",
      "messages": [{"role": "user", "content": "Respond with: Cerebras verified"}]
    }'
  ```

---

### 5. Mistral AI

- **OmniRoute ID**: `mistral` (Alias: `mistral`)
- **Category**: `frontier-labs`
- **Why Selected**: Mistral AI is the leading European frontier AI lab and creator of **Codestral** — an industry-standard 22B model specifically pre-trained and fine-tuned for 80+ programming languages, Fill-in-the-Middle (FIM), and code completion.
- **Direct Signup URL**: [https://console.mistral.ai/api-keys/](https://console.mistral.ai/api-keys/)
  1. Register an account at [console.mistral.ai](https://console.mistral.ai).
  2. Navigate to **API Keys** → **Create new key**.
  3. Copy your API key.
- **Free Tier Quotas & Limits**:
  - **Free Experiment Tier**: 1 RPS (60 RPM) and 500,000 tokens/minute.
  - **Credit Card**: No credit card required.
  - Full access to experimental and code models (`codestral-latest`, `devstral-latest`, `mistral-small-latest`).
- **Key Models**:
  - `codestral-latest` (Premier coding engine)
  - `devstral-latest` (Agentic software engineering)
  - `mistral-large-latest`
  - `mistral-small-latest`
- **Environment Variable**:
  ```bash
  MISTRAL_API_KEY=your_mistral_api_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add mistral --credential "$MISTRAL_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "mistral/codestral-latest",
      "messages": [{"role": "user", "content": "Write a 1-line Python lambda for fibonacci"}]
    }'
  ```

---

### 6. OpenRouter

- **OmniRoute ID**: `openrouter` (Alias: `openrouter`)
- **Category**: `gateways`
- **Why Selected**: OpenRouter indexes and routes between hundreds of upstream AI models. It features dedicated **100% Free**: unmetered access to models with the `:free` suffix, acting as the ultimate fallback layer when direct provider rate limits are exhausted.
- **Direct Signup URL**: [https://openrouter.ai/keys](https://openrouter.ai/keys)
  1. Sign in via GitHub, Google, or Web3 wallet.
  2. Go to **Keys** → **Create Key**.
  3. Label it `omniroute` and copy the key (prefix: `sk-or-v1-...`).
- **Free Tier Quotas & Limits**:
  - **Free Model Suffix**: Models ending with `:free` cost $0.00 / token.
  - **Rate Limit**: 20 RPM / 200 Requests Per Day.
  - OmniRoute features native integration with OpenRouter's `/api/v1/auth/key` probe and passthrough model routing.
- **Key Models**:
  - `openrouter/auto` (Dynamically picks the best available free model)
  - `meta-llama/llama-3.3-70b-instruct:free`
  - `deepseek/deepseek-r1:free`
  - `qwen/qwen-2.5-coder-32b-instruct:free`
  - `google/gemini-2.0-flash-exp:free`
- **Environment Variable**:
  ```bash
  OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add openrouter --credential "$OPENROUTER_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "openrouter/auto",
      "messages": [{"role": "user", "content": "Respond with: OpenRouter verified"}]
    }'
  ```

---

### 7. DeepSeek Platform

- **OmniRoute ID**: `deepseek` (Alias: `ds`)
- **Category**: `regional`
- **Why Selected**: DeepSeek leads the industry in open-source reasoning (R1) and cost efficiency (V3/V4). OmniRoute natively supports DeepSeek's OpenAI-compatible and Anthropic-compatible endpoints with thinking effort control (`low`, `high`, `max`).
- **Direct Signup URL**: [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
  1. Sign up at [platform.deepseek.com](https://platform.deepseek.com).
  2. Navigate to **API Keys** → **Create API Key**.
  3. Copy your key (prefix: `sk-...`).
- **Free Tier Quotas & Limits**:
  - **Signup Bonus**: 5,000,000 free tokens upon account creation (valid without credit card).
  - **Context & Output**: 1,000,000 token context window, 384,000 max output tokens.
  - Supports full reasoning/thinking trace streaming and function tool calling.
- **Key Models**:
  - `deepseek/deepseek-v4-pro`
  - `deepseek/deepseek-v4-flash`
- **Environment Variable**:
  ```bash
  DEEPSEEK_API_KEY=sk-your_deepseek_key_here
  ```
- **OmniRoute CLI Setup**:
  ```bash
  omniroute providers add deepseek --credential "$DEEPSEEK_API_KEY"
  ```
- **Instant Verification**:
  ```bash
  curl -X POST http://127.0.0.1:20128/v1/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer omniroute" \
    -d '{
      "model": "deepseek/deepseek-v4-flash",
      "messages": [{"role": "user", "content": "Explain binary search in 10 words"}]
    }'
  ```

---

## Ready-to-Use `/home/stavan/omniroute/.env` Template

Copy and paste the snippet below into `/home/stavan/omniroute/.env`:

```env
# ═══════════════════════════════════════════════════════════════════════════════
# OMNIROUTE MASTER FREE-TIER PROVIDER CREDENTIALS
# ═══════════════════════════════════════════════════════════════════════════════

# 1. NVIDIA NIM (https://build.nvidia.com)
NVIDIA_API_KEY=nvapi-your_key_here

# 2. Google AI Studio (https://aistudio.google.com/app/apikey)
GEMINI_API_KEY=AIzaSy_your_key_here
GOOGLE_API_KEY=AIzaSy_your_key_here

# 3. Groq Cloud (https://console.groq.com/keys)
GROQ_API_KEY=gsk_your_key_here

# 4. Cerebras Cloud (https://cloud.cerebras.ai)
CEREBRAS_API_KEY=csk_your_key_here

# 5. Mistral AI (https://console.mistral.ai/api-keys/)
MISTRAL_API_KEY=your_key_here

# 6. OpenRouter (https://openrouter.ai/keys)
OPENROUTER_API_KEY=sk-or-v1-your_key_here

# 7. DeepSeek Platform (https://platform.deepseek.com/api_keys)
DEEPSEEK_API_KEY=sk-your_key_here
```

---

## One-Click Batch Setup Script (`scripts/setup-free-providers.sh`)

Once the `.env` file is populated with your keys, run this automation script to register and validate all 7 providers simultaneously into OmniRoute's encrypted SQLite database:

```bash
#!/usr/bin/env bash
set -e

echo "=== Registering OmniRoute Free Providers ==="

# Load environment variables from .env
if [ -f "/home/stavan/omniroute/.env" ]; then
  export $(grep -v '^#' /home/stavan/omniroute/.env | xargs -d '\n')
fi

# 1. NVIDIA NIM
if [ -n "$NVIDIA_API_KEY" ]; then
  echo "-> Adding NVIDIA NIM..."
  omniroute providers add nvidia --credential "$NVIDIA_API_KEY" || true
fi

# 2. Google Gemini
if [ -n "$GEMINI_API_KEY" ]; then
  echo "-> Adding Google AI Studio (Gemini)..."
  omniroute providers add gemini --credential "$GEMINI_API_KEY" || true
fi

# 3. Groq Cloud
if [ -n "$GROQ_API_KEY" ]; then
  echo "-> Adding Groq Cloud..."
  omniroute providers add groq --credential "$GROQ_API_KEY" || true
fi

# 4. Cerebras Cloud
if [ -n "$CEREBRAS_API_KEY" ]; then
  echo "-> Adding Cerebras Cloud..."
  omniroute providers add cerebras --credential "$CEREBRAS_API_KEY" || true
fi

# 5. Mistral AI
if [ -n "$MISTRAL_API_KEY" ]; then
  echo "-> Adding Mistral AI..."
  omniroute providers add mistral --credential "$MISTRAL_API_KEY" || true
fi

# 6. OpenRouter
if [ -n "$OPENROUTER_API_KEY" ]; then
  echo "-> Adding OpenRouter..."
  omniroute providers add openrouter --credential "$OPENROUTER_API_KEY" || true
fi

# 7. DeepSeek
if [ -n "$DEEPSEEK_API_KEY" ]; then
  echo "-> Adding DeepSeek..."
  omniroute providers add deepseek --credential "$DEEPSEEK_API_KEY" || true
fi

echo "=== Current Configured Connections ==="
omniroute providers list
```

---

## Comprehensive Health & Verification Suite

After configuring your providers, run these checks to confirm end-to-end functionality:

### 1. Check Configured Providers via CLI

```bash
omniroute providers list
```

_Expected Output_: Displays each configured provider with green `active` or `success` test status.

### 2. Run Comprehensive Provider Tests

```bash
# Test all configured provider connections
omniroute providers test-all

# Or test individual connections
omniroute test gemini
omniroute test groq
omniroute test mistral
omniroute test openrouter
```

### 3. Verify Endpoint Catalog via HTTP Proxy

```bash
curl -s http://127.0.0.1:20128/v1/models | jq '.data[].id' | head -n 25
```

_Expected Output_: List containing model identifiers from Gemini, Groq, NVIDIA, Cerebras, Mistral, DeepSeek, and OpenRouter ready to route.
