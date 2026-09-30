/**
 * Comparação lado a lado: Maria só com roteiro × Maria atriz, nas mesmas falas de interno.
 * Uso (na máquina com dependências e .env configurado):
 *   PV001_LLM_INTENT=true PV001_LLM_ACTOR=true MIMO_API_KEY=... bun docs/pv001/actor-compare.ts
 * Sem chave, gera só a coluna do roteiro e marca a coluna da atriz como pendente.
 * Grava docs/pv001/actor-compare.md. Nada é inventado: cada fala vem do motor ou do modelo.
 */
import { writeFileSync } from "node:fs";
import { createSession, respond, type IntentInput, type Session } from "../../src/lib/pv001/engine";
import { classifyIntent, intentConfig, intentStateOf } from "../../src/lib/pv001/intent";
import {
  actorConfig,
  actorRequestOf,
  perform,
  performable,
  performWithModel,
} from "../../src/lib/pv001/actor";

/** Falas naturais de interno, com paráfrases e perguntas fora do roteiro. */
export const CONSULTA = [
  "Bom dia, dona Maria, tudo bem com a senhora?",
  "O que a senhora entendeu dos seus exames?",
  "É normal ficar assustada. Seu rim ainda funciona, e a gente tem como segurar essa perda.",
  "A senhora tem alguma alergia a remédio?",
  "Quais remédios a senhora toma hoje?",
  "Eu queria incluir mais um comprimido no seu tratamento.",
  "Esse remédio ajuda a proteger os rins e também o coração, não é só para o açúcar.",
  "A senhora consegue pegar de graça, pela farmácia do componente especializado; eu faço o laudo.",
  "Ficou alguma dúvida?",
];

async function run(useModels: boolean) {
  const icfg = intentConfig(process.env);
  const acfg = actorConfig(process.env);
  const provider =
    useModels && (icfg.enabled || acfg.enabled)
      ? await import("../../src/lib/pv001/intent-provider.server")
      : null;
  const start = Date.parse("2026-09-30T12:00:00Z");
  let s: Session = createSession(
    "comparacao",
    `comparacao-${useModels ? "atriz" : "roteiro"}`,
    start,
  );
  for (const [i, text] of CONSULTA.entries()) {
    const now = start + (i + 1) * 45000;
    let intent: IntentInput = { source: "regex", reason: "local" };
    if (provider && icfg.enabled) {
      const r = await classifyIntent(
        { text, state: intentStateOf(s) },
        { generate: provider.intentGenerator(icfg), model: icfg.model },
      );
      intent =
        r.source === "llm"
          ? { source: "llm", signals: r.signals, model: r.model }
          : { source: "regex", reason: r.reason };
    }
    s = respond(s, text, now, intent);
    const last = s.transcript.at(-1)!;
    if (provider && acfg.enabled && performable(last)) {
      const r = await performWithModel(actorRequestOf(s, last), {
        generate: provider.intentGenerator(acfg, 0.7),
        model: acfg.model,
      });
      s = perform(s, last.turn, r);
    }
  }
  return s;
}

const rows = (s: Session) =>
  s.transcript
    .filter((t) => t.role !== "system")
    .map((t) => ({ role: t.role, text: t.text, voice: t.performance }));

if (import.meta.main) {
  const script = await run(false);
  const live = intentConfig(process.env).enabled || actorConfig(process.env).enabled;
  const actor = live ? await run(true) : null;
  const a = rows(script);
  const b = actor ? rows(actor) : null;
  const esc = (x: string) => x.replace(/\|/g, "\\|");
  const lines = [
    "# PV-001 — Maria só roteiro × Maria atriz",
    "",
    `Gerado por \`bun docs/pv001/actor-compare.ts\` em ${new Date().toISOString().slice(0, 10)}. Mesmas falas do interno nas duas colunas.`,
    "",
    b
      ? `Modelo: ${actorConfig(process.env).enabled ? "atriz ligada" : "atriz desligada"}, ${intentConfig(process.env).enabled ? "intérprete por IA ligado" : "intérprete por regras"}.`
      : "**Coluna da atriz pendente:** sem chave configurada. Nenhuma fala foi estimada.",
    "",
    "| Quem | Só roteiro | Atriz |",
    "| --- | --- | --- |",
    ...a.map((r, i) => {
      const other = b?.[i];
      const cell = other
        ? `${esc(other.text)}${other.voice?.by === "script" ? ` _(roteiro: ${other.voice.reason})_` : ""}`
        : "pendente";
      return `| ${r.role === "student" ? "Interno" : "Maria"} | ${esc(r.text)} | ${r.role === "student" ? esc(r.text) : cell} |`;
    }),
    "",
  ];
  writeFileSync(new URL("./actor-compare.md", import.meta.url), lines.join("\n"));
  console.log(b ? "comparação gerada" : "só a coluna do roteiro (sem chave)");
}
