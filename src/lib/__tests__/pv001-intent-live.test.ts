/**
 * Integration test with the real intent model. PENDING unless the server environment has
 * PV001_LLM_INTENT=true and a key (MIMO_API_KEY or PV001_INTENT_API_KEY). Never invents results.
 * Run: PV001_LLM_INTENT=true bun run test src/lib/__tests__/pv001-intent-live.test.ts
 */
import { describe, expect, it } from "vitest";
import { evaluateInterpreter, ITEMS, renderReport } from "../../../docs/pv001/intent-eval";
import { createSession, type IntentSignals } from "../pv001/engine";
import { classifyIntent, intentConfig, intentStateOf } from "../pv001/intent";

const cfg = intentConfig(process.env);

describe.skipIf(!cfg.enabled)("PV-001 v1.2 — real model on the paraphrase corpus", () => {
  it(
    "classifies the corpus, falling back only with a recorded reason",
    async () => {
      if (!cfg.enabled) return;
      const { intentGenerator } = await import("../pv001/intent-provider.server");
      const generate = intentGenerator(cfg);
      const state = intentStateOf(createSession("live", "live", Date.now()));
      const results = new Map<string, IntentSignals | null>();
      const fallbacks: string[] = [];
      for (const item of ITEMS) {
        const r = await classifyIntent({ text: item.text, state }, { generate, model: cfg.model });
        results.set(item.text, r.source === "llm" ? r.signals : null);
        if (r.source === "regex") fallbacks.push(`${item.id}:${r.reason}`);
      }
      const report = evaluateInterpreter((text) => results.get(text) ?? null);
      console.log(renderReport(`Intérprete por IA (${cfg.model})`, report));
      console.log(`Fallbacks: ${fallbacks.length ? fallbacks.join(", ") : "nenhum"}`);
      expect(report.total).toBe(ITEMS.length);
    },
    ITEMS.length * 6000,
  );
});
