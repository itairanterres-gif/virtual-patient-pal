/**
 * Diagnóstico da conexão com o modelo (não mostra a chave).
 * Uso: bun docs/pv001/model-debug.ts
 */
import {
  intentConfig,
  INTENT_SYSTEM_PROMPT,
  buildIntentPrompt,
  parseModelText,
  intentStateOf,
} from "../../src/lib/pv001/intent";
import { createSession } from "../../src/lib/pv001/engine";

const cfg = intentConfig(process.env);
if (!cfg.enabled) {
  console.log(`Intérprete desligado: ${cfg.reason}`);
  process.exit(0);
}
console.log(
  `Modelo: ${cfg.model} | Endereço: ${cfg.baseURL} | Chave: ${cfg.apiKey.length} caracteres`,
);
const { intentGenerator } = await import("../../src/lib/pv001/intent-provider.server");
const generate = intentGenerator(cfg);

async function attempt(label: string, system: string, prompt: string) {
  const t = Date.now();
  try {
    const text = await generate({ system, prompt, signal: AbortSignal.timeout(30000) });
    console.log(`\n[${label}] OK em ${((Date.now() - t) / 1000).toFixed(1)} s`);
    console.log(`Resposta bruta: ${JSON.stringify(text).slice(0, 800)}`);
    return text;
  } catch (e) {
    const err = e as {
      name?: string;
      message?: string;
      statusCode?: number;
      responseBody?: string;
      cause?: unknown;
    };
    console.log(`\n[${label}] ERRO em ${((Date.now() - t) / 1000).toFixed(1)} s`);
    console.log(`Tipo: ${err.name} | Status: ${err.statusCode ?? "—"}`);
    console.log(`Mensagem: ${String(err.message).slice(0, 600)}`);
    if (err.responseBody) console.log(`Corpo: ${err.responseBody.slice(0, 600)}`);
    if (err.cause)
      console.log(`Causa: ${String((err.cause as Error).message ?? err.cause).slice(0, 300)}`);
    return null;
  }
}

await attempt("teste simples", "Responda apenas: ok", "teste");
const text = await attempt(
  "classificação real",
  INTENT_SYSTEM_PROMPT,
  buildIntentPrompt({
    text: "A senhora consegue pegar de graça.",
    state: intentStateOf(createSession("debug", "debug", Date.now())),
  }),
);
if (text !== null)
  console.log(`\nJSON aceito pelo validador: ${parseModelText(text) ? "sim" : "NÃO"}`);
