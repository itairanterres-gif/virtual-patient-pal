import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import type { Generate, IntentConfig } from "./intent";

/**
 * OpenAI-compatible provider for the intent classifier (MiMo by default; base URL, key and
 * model come from server environment variables). Separate from the shared ai-gateway.
 */
export function intentGenerator(cfg: Extract<IntentConfig, { enabled: true }>): Generate {
  const provider = createOpenAICompatible({
    name: "pv001-intent",
    baseURL: cfg.baseURL,
    apiKey: cfg.apiKey,
  });
  return async ({ system, prompt, signal }) => {
    const result = await generateText({
      model: provider(cfg.model),
      system,
      prompt,
      temperature: 0,
      maxRetries: 0,
      abortSignal: signal,
    });
    return result.text;
  };
}

// Per-process ceiling, as in the audio preview. Not a substitute for per-user quotas.
let windowStart = Date.now();
let calls = 0;
export function withinBudget(limit = 600) {
  if (Date.now() - windowStart > 3600000) {
    windowStart = Date.now();
    calls = 0;
  }
  return ++calls <= limit;
}
