import { createServerFn } from "@tanstack/react-start";
import { classifyIntent, intentConfig, intentRequest, type IntentResult } from "./intent";

/** Whether model interpretation is configured on the server (no secret is exposed). */
export const intentCapabilities = createServerFn({ method: "GET" }).handler(() => ({
  enabled: intentConfig(process.env).enabled,
}));

/**
 * Receives only the current student utterance and a minimal state summary; returns detection
 * flags or a fallback reason. It never returns text for the patient.
 */
export const interpretIntent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => intentRequest.parse(data))
  .handler(async ({ data }): Promise<IntentResult> => {
    const cfg = intentConfig(process.env);
    if (!cfg.enabled) return { source: "regex", reason: cfg.reason };
    try {
      const { intentGenerator, withinBudget } = await import("./intent-provider.server");
      if (!withinBudget()) return { source: "regex", reason: "budget" };
      return await classifyIntent(data, { generate: intentGenerator(cfg), model: cfg.model });
    } catch {
      // Provider bodies, credentials and the utterance are never echoed back.
      return { source: "regex", reason: "error" };
    }
  });
