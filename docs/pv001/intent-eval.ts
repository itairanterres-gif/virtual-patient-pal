/**
 * Mede um intérprete de intenção contra docs/pv001/paraphrase-corpus.json.
 * Uso: bun docs/pv001/intent-eval.ts  (mede as regex e reescreve intent-eval.md)
 * A função `evaluateInterpreter` é reutilizada pelo teste de integração com o modelo real.
 */
import { writeFileSync } from "node:fs";
import corpus from "./paraphrase-corpus.json";
import {
  INTENT_FLAGS,
  regexIntent,
  type IntentFlag,
  type IntentSignals,
} from "../../src/lib/pv001/engine";

export type CorpusItem = {
  id: string;
  category: string;
  text: string;
  true: string[];
  historyRequests: string[];
};
export const ITEMS = corpus.items as CorpusItem[];

export function expected(item: CorpusItem) {
  return {
    flags: Object.fromEntries(INTENT_FLAGS.map((f) => [f, item.true.includes(f)])) as Record<
      IntentFlag,
      boolean
    >,
    history: [...item.historyRequests].sort(),
  };
}

export type Report = {
  total: number;
  exact: number;
  perFlag: Record<string, { tp: number; fp: number; fn: number; tn: number }>;
  history: { tp: number; fp: number; fn: number };
  misses: { id: string; text: string; wrong: string[] }[];
};

export function evaluateInterpreter(
  interpret: (text: string) => IntentSignals | null,
  items = ITEMS,
): Report {
  const perFlag = Object.fromEntries(
    [...INTENT_FLAGS].map((f) => [f, { tp: 0, fp: 0, fn: 0, tn: 0 }]),
  ) as Report["perFlag"];
  const history = { tp: 0, fp: 0, fn: 0 };
  const misses: Report["misses"] = [];
  let exact = 0;
  for (const item of items) {
    const want = expected(item);
    const got = interpret(item.text);
    const wrong: string[] = [];
    for (const f of INTENT_FLAGS) {
      const g = got?.[f] === true;
      const w = want.flags[f];
      const cell = perFlag[f]!;
      if (g && w) cell.tp++;
      else if (g && !w) {
        cell.fp++;
        wrong.push(`+${f}`);
      } else if (!g && w) {
        cell.fn++;
        wrong.push(`-${f}`);
      } else cell.tn++;
    }
    const gh = new Set<string>(got?.historyRequests ?? []);
    for (const id of want.history) {
      if (gh.has(id)) history.tp++;
      else {
        history.fn++;
        wrong.push(`-hist:${id}`);
      }
    }
    for (const id of gh) {
      if (want.history.includes(id)) continue;
      history.fp++;
      wrong.push(`+hist:${id}`);
    }
    if (!got) wrong.push("sem_resposta");
    if (wrong.length === 0) exact++;
    else misses.push({ id: item.id, text: item.text, wrong });
  }
  return { total: items.length, exact, perFlag, history, misses };
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((100 * n) / d)}%`);

export function renderReport(title: string, r: Report) {
  const rows = Object.entries(r.perFlag).map(([f, c]) => {
    const positives = c.tp + c.fn;
    return `| ${f} | ${positives} | ${c.tp} | ${c.fn} | ${c.fp} | ${pct(c.tp, positives)} | ${pct(c.tp, c.tp + c.fp)} |`;
  });
  const h = r.history;
  rows.push(
    `| historyRequests (itens de anamnese) | ${h.tp + h.fn} | ${h.tp} | ${h.fn} | ${h.fp} | ${pct(h.tp, h.tp + h.fn)} | ${pct(h.tp, h.tp + h.fp)} |`,
  );
  const misses = r.misses.map((m) => `| ${m.id} | ${m.text} | ${m.wrong.join(", ")} |`);
  return [
    `## ${title}`,
    "",
    `Falas com detecção inteiramente correta: **${r.exact} de ${r.total} (${pct(r.exact, r.total)})**.`,
    "",
    "| Sinal | Falas em que deveria aparecer | Detectou | Perdeu | Detectou sem dever | Sensibilidade | Precisão |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
    "### Falas com erro de detecção",
    "",
    "`-sinal` = deixou de detectar; `+sinal` = detectou sem dever.",
    "",
    "| id | Fala | Erro |",
    "| --- | --- | --- |",
    ...misses,
  ].join("\n");
}

if (import.meta.main) {
  const regex = evaluateInterpreter((text) => regexIntent(text));
  const doc = [
    "# PV-001 v1.2 — medição do intérprete de intenção",
    "",
    `Corpus: \`paraphrase-corpus.json\`, ${regex.total} falas naturais de interno, rotuladas pelo autor do caso e sujeitas a revisão docente. Gerado por \`bun docs/pv001/intent-eval.ts\`.`,
    "",
    "Sensibilidade = das falas em que o sinal deveria aparecer, quantas o intérprete detectou. Precisão = das vezes em que detectou, quantas estavam certas. O corpus foi escrito de propósito com paráfrases que as regex não cobrem; o número mede a lacuna, não o desempenho esperado com estudantes reais.",
    "",
    renderReport("Intérprete por regras (regex, v1.1)", regex),
    "",
    "## Intérprete por IA",
    "",
    "**Pendente.** O teste de integração (`src/lib/__tests__/pv001-intent-live.test.ts`) está pronto e roda só com `PV001_LLM_INTENT=true` e chave configurada. Nenhum resultado foi estimado ou inventado.",
    "",
  ].join("\n");
  writeFileSync(new URL("./intent-eval.md", import.meta.url), doc);
  console.log(`regex: ${regex.exact}/${regex.total} falas exatas`);
}
