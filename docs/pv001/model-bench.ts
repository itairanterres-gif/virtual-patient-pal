/**
 * Mede velocidade de modelos na mesma classificação (não mostra a chave).
 * Uso: bun docs/pv001/model-bench.ts mimo-v2.6-flash mimo-v2.6-pro-ultraspeed mimo-v2.5
 */
import { createSession } from "../../src/lib/pv001/engine";
import {
  buildIntentPrompt,
  intentConfig,
  intentStateOf,
  INTENT_SYSTEM_PROMPT,
  parseModelText,
} from "../../src/lib/pv001/intent";

const cfg = intentConfig(process.env);
if (!cfg.enabled) {
  console.log(`Intérprete desligado: ${cfg.reason}`);
  process.exit(0);
}
const models = process.argv.slice(2).length ? process.argv.slice(2) : [cfg.model];
const texts = [
  "Eu queria incluir mais um comprimido no seu tratamento.",
  "A senhora tem alguma alergia a remédio?",
  "Esse remédio ajuda a proteger os rins e também o coração, não é só para o açúcar.",
];
const state = intentStateOf(createSession("bench", "bench", Date.now()));
const mimo = /xiaomimimo\.com/.test(cfg.baseURL);

for (const model of models) {
  const times: number[] = [];
  const notes: string[] = [];
  for (const text of texts) {
    const t = Date.now();
    try {
      const res = await fetch(`${cfg.baseURL}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          messages: [
            { role: "system", content: INTENT_SYSTEM_PROMPT },
            { role: "user", content: buildIntentPrompt({ text, state }) },
          ],
          ...(mimo ? { thinking: { type: "disabled" } } : {}),
        }),
        signal: AbortSignal.timeout(30000),
      });
      const body = (await res.json()) as {
        choices?: { message?: { content?: string; reasoning_content?: string } }[];
        usage?: {
          completion_tokens?: number;
          completion_tokens_details?: { reasoning_tokens?: number };
        };
        error?: { message?: string };
      };
      times.push(Date.now() - t);
      if (!res.ok) {
        notes.push(`HTTP ${res.status} ${body.error?.message ?? ""}`);
        continue;
      }
      const msg = body.choices?.[0]?.message;
      const parsed = parseModelText(msg?.content ?? "");
      const reasoning =
        body.usage?.completion_tokens_details?.reasoning_tokens ??
        (msg?.reasoning_content ? "sim" : 0);
      const flags = parsed
        ? Object.entries(parsed)
            .filter(([k, v]) => v === true || (k === "historyRequests" && (v as string[]).length))
            .map(([k, v]) => (k === "historyRequests" ? `hist:${(v as string[]).join("+")}` : k))
            .join(",") || "nenhum"
        : "JSON inválido";
      notes.push(
        `${((Date.now() - t) / 1000).toFixed(1)}s tokens=${body.usage?.completion_tokens ?? "?"} raciocínio=${reasoning} → ${flags}`,
      );
    } catch (e) {
      times.push(Date.now() - t);
      notes.push(`erro: ${(e as Error).message}`);
    }
  }
  const avg = times.reduce((a, b) => a + b, 0) / times.length / 1000;
  console.log(`\n${model}: média ${avg.toFixed(1)} s`);
  for (const [i, n] of notes.entries()) console.log(`  "${texts[i]}"\n    ${n}`);
}
