#!/usr/bin/env bash
# OmniRoute Batch Free Provider Setup
set -e

ENV_FILE="/home/stavan/omniroute/.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading keys from $ENV_FILE..."
  # Export variables without comments
  export $(grep -E '^[A-Za-z0-9_]+=' "$ENV_FILE" | xargs -d '\n')
fi

echo "============================================================"
echo "          OmniRoute Free Provider Key Registrator          "
echo "============================================================"

# 1. NVIDIA NIM
if [ -n "$NVIDIA_API_KEY" ] && [ "$NVIDIA_API_KEY" != "nvapi-your_key_here" ]; then
  echo "-> Adding NVIDIA NIM..."
  omniroute providers add nvidia --credential "$NVIDIA_API_KEY" || true
else
  echo "[-] Skipping NVIDIA NIM (unset or placeholder)"
fi

# 2. Google Gemini
if [ -n "$GEMINI_API_KEY" ] && [ "$GEMINI_API_KEY" != "AIzaSy_your_key_here" ]; then
  echo "-> Adding Google AI Studio (Gemini)..."
  omniroute providers add gemini --credential "$GEMINI_API_KEY" || true
elif [ -n "$GOOGLE_API_KEY" ] && [ "$GOOGLE_API_KEY" != "AIzaSy_your_key_here" ]; then
  echo "-> Adding Google AI Studio via GOOGLE_API_KEY..."
  omniroute providers add gemini --credential "$GOOGLE_API_KEY" || true
else
  echo "[-] Skipping Gemini (unset or placeholder)"
fi

# 3. Groq Cloud
if [ -n "$GROQ_API_KEY" ] && [ "$GROQ_API_KEY" != "gsk_your_key_here" ]; then
  echo "-> Adding Groq Cloud..."
  omniroute providers add groq --credential "$GROQ_API_KEY" || true
else
  echo "[-] Skipping Groq (unset or placeholder)"
fi

# 4. Cerebras Cloud
if [ -n "$CEREBRAS_API_KEY" ] && [ "$CEREBRAS_API_KEY" != "csk_your_key_here" ]; then
  echo "-> Adding Cerebras Cloud..."
  omniroute providers add cerebras --credential "$CEREBRAS_API_KEY" || true
else
  echo "[-] Skipping Cerebras (unset or placeholder)"
fi

# 5. Mistral AI
if [ -n "$MISTRAL_API_KEY" ] && [ "$MISTRAL_API_KEY" != "your_key_here" ]; then
  echo "-> Adding Mistral AI..."
  omniroute providers add mistral --credential "$MISTRAL_API_KEY" || true
else
  echo "[-] Skipping Mistral AI (unset or placeholder)"
fi

# 6. OpenRouter
if [ -n "$OPENROUTER_API_KEY" ] && [ "$OPENROUTER_API_KEY" != "sk-or-v1-your_key_here" ]; then
  echo "-> Adding OpenRouter..."
  omniroute providers add openrouter --credential "$OPENROUTER_API_KEY" || true
else
  echo "[-] Skipping OpenRouter (unset or placeholder)"
fi

# 7. DeepSeek Platform
if [ -n "$DEEPSEEK_API_KEY" ] && [ "$DEEPSEEK_API_KEY" != "sk-your_key_here" ]; then
  echo "-> Adding DeepSeek..."
  omniroute providers add deepseek --credential "$DEEPSEEK_API_KEY" || true
else
  echo "[-] Skipping DeepSeek (unset or placeholder)"
fi

echo ""
echo "============================================================"
echo "          Current Configured Provider Connections           "
echo "============================================================"
omniroute providers list || true
