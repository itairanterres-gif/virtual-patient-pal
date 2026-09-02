/**
 * Escopo de fatos por ator e validação anti-vazamento.
 *
 * A proteção NÃO depende do prompt: além de validar os IDs devolvidos pelo
 * modelo, o texto é validado contra os fatos autorizados. Qualquer afirmação
 * clínica não sustentada descarta a resposta inteira e o motor usa uma
 * resposta determinística segura.
 */

import {
  forbiddenActorTerms,
  maeFacts,
  theoFacts,
  type ActorFact,
} from "./case-theo";

export type SpeakingActor = "theo" | "mae";

export function factsForActor(actor: SpeakingActor): ActorFact[] {
  return actor === "theo" ? theoFacts : maeFacts;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Afirmações sobre o futuro/consequência que o ator não pode fazer. */
const forbiddenClaimPatterns = [
  /vai (piorar|parar|precisar|melhorar)/,
  /pode (morrer|parar de respirar|intubar)/,
  /precisa (de|ser) (internad|intubad|uti)/,
  /o exame (mostrou|deu)/,
  /o resultado (foi|deu)/,
  /est(a|á) com \d+/,
];

export type ActorValidation =
  | { ok: true; reply: string; factIds: string[] }
  | { ok: false; reason: string; reply: string; factIds: string[] };

const FALLBACK: Record<SpeakingActor, string> = {
  theo: "Théo olha para você, respira com dificuldade e não responde nada além disso.",
  mae: "A mãe hesita: “Desculpa, isso eu não sei responder.”",
};

/**
 * Valida a resposta do modelo. Rejeita:
 * - IDs inexistentes ou de outro ator;
 * - termos objetivos/diagnósticos proibidos;
 * - números que não aparecem nos fatos autorizados;
 * - afirmações sobre exames, resultados ou consequências futuras.
 */
export function validateActorReply(
  actor: SpeakingActor,
  rawReply: string,
  rawIds: string[],
): ActorValidation {
  const allowed = factsForActor(actor);
  const allowedIds = new Set(allowed.map((f) => f.id));
  const reply = (rawReply ?? "").trim();
  const fail = (reason: string): ActorValidation => ({
    ok: false,
    reason,
    reply: FALLBACK[actor],
    factIds: [],
  });

  if (!reply) return fail("resposta vazia");
  if (rawIds.some((id) => !allowedIds.has(id)))
    return fail("ID de fato inexistente ou de outro ator");

  const t = norm(reply);
  const hit = forbiddenActorTerms.find((term) => t.includes(norm(term)));
  if (hit) return fail(`termo proibido para o ator: "${hit}"`);

  if (forbiddenClaimPatterns.some((re) => re.test(t)))
    return fail("afirmação clínica não sustentada pelos fatos autorizados");

  // Números só podem existir se aparecerem nos fatos autorizados do ator.
  const corpus = norm(allowed.map((f) => f.content).join(" "));
  const numbers = t.match(/\d+/g) ?? [];
  const badNumber = numbers.find((n) => !corpus.includes(n));
  if (badNumber) return fail(`número não sustentado pelos fatos autorizados: ${badNumber}`);

  return { ok: true, reply, factIds: rawIds.filter((id) => allowedIds.has(id)) };
}

/** Prompt do ator: recebe SOMENTE os fatos que ele pode conhecer. */
export function buildActorPrompt(actor: SpeakingActor): string {
  const facts = factsForActor(actor);
  const persona =
    actor === "theo"
      ? "Você é Théo, uma criança de 6 anos com falta de ar, no pronto-socorro. Fala com frases curtas, vocabulário infantil, precisa parar para respirar. Você NÃO sabe nada sobre exames, aparelhos, números ou nomes de doenças."
      : "Você é a mãe do Théo, 34 anos, preocupada. Você conhece a história do filho, o que aconteceu em casa e as crises anteriores. Você NÃO sabe resultados de exames, valores de aparelhos, achados de ausculta nem o nome técnico do que ele tem.";

  return [
    persona,
    "Responda SEMPRE em português do Brasil, em primeira pessoa, com no máximo 3 frases.",
    "Use exclusivamente o conteúdo dos fatos autorizados abaixo. É proibido inventar qualquer informação, número, achado ou diagnóstico.",
    "Se perguntarem algo que não está nos fatos, diga naturalmente que não sabe.",
    "Nunca mencione saturação, frequências, ausculta, exames, aparelhos, medicamentos por nome técnico, diagnósticos ou o que vai acontecer depois.",
    "",
    "FATOS AUTORIZADOS:",
    ...facts.map((f) => `- [${f.id}] ${f.label}: ${f.content}`),
    "",
    'Devolva JSON com "reply" (sua fala) e "factIds" (os ids dos fatos usados; lista vazia se não usou nenhum).',
  ].join("\n");
}

/** Canal operacional da equipe — determinístico, sem LLM. */
export function teamReply(question: string): string {
  const t = norm(question);
  if (/oxig/.test(t)) return "Equipe: temos cateter nasal, máscara facial e máscara com reservatório disponíveis. Informe dispositivo e fluxo.";
  if (/salbutamol|bombinha|inala|nebuli/.test(t)) return "Equipe: temos salbutamol spray com espaçador e solução para nebulização. Informe a dose e a apresentação.";
  if (/monitor|oximet/.test(t)) return "Equipe: o monitor está no leito; peça a verificação quando quiser.";
  if (/peso/.test(t)) return "Equipe: peso não foi aferido aqui; confirme com a mãe.";
  if (/exame|raio|gaso|hemograma/.test(t)) return "Equipe: podemos coletar exames; a solicitação precisa dizer qual exame.";
  return "Equipe: pronta para executar o que for solicitado — descreva a ação completa.";
}
