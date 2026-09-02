/**
 * Escopo de fatos por ator e validação de grounding.
 *
 * A proteção NÃO depende do prompt e NÃO é uma lista de proibições: a fala do
 * ator só é aceita se **decorrer dos fatos que ela própria citou**.
 *
 * Contrato de uma fala válida:
 * 1. `factIds` referencia apenas fatos existentes do próprio ator;
 * 2. no máximo `MAX_FATOS_CITADOS` fatos por fala, e cada fato citado tem de ser
 *    de fato usado (corpus-padding é rejeitado);
 * 3. toda palavra de conteúdo da fala aparece nas verbalizações autorizadas dos
 *    fatos citados — o restante só pode ser função gramatical ou fórmula social;
 * 4. todo número da fala aparece nas verbalizações dos fatos CITADOS (não no
 *    corpus inteiro do ator);
 * 5. `factIds` vazio só é aceito se a fala for puramente social ou uma recusa
 *    ("não sei", "não lembro") — nunca para conteúdo clínico;
 * 6. termos objetivos proibidos e afirmações não sustentadas seguem barrados.
 *
 * Qualquer violação descarta a resposta inteira e o motor usa a fala de
 * fallback determinística.
 *
 * Limite conhecido e deliberado: esta validação limita o VOCABULÁRIO ao dos
 * fatos citados, o que não é o mesmo que garantir semântica. Inversões de
 * sentido montadas com palavras autorizadas (por exemplo atribuir ao Théo a
 * asma que é da mãe) não são detectáveis por derivação lexical e continuam
 * cobertas por padrão explícito em `forbiddenClaimPatterns`.
 */

import {
  forbiddenActorTerms,
  maeFacts,
  theoFacts,
  verbalizacoesDe,
  type ActorFact,
} from "./case-theo";

export type SpeakingActor = "theo" | "mae";

/** Uma fala tem no máximo 3 frases; citar mais que isso é alargar corpus. */
export const MAX_FATOS_CITADOS = 3;

export function factsForActor(actor: SpeakingActor): ActorFact[] {
  return actor === "theo" ? theoFacts : maeFacts;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const tokens = (s: string) =>
  norm(s)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

/**
 * Palavras de função: não carregam informação clínica e por isso são livres.
 * Lista FECHADA — nada de conteúdo entra aqui. Toda palavra clinicamente
 * significativa tem de vir dos fatos citados.
 */
const STOPWORDS = new Set(
  tokens(`a o as os um uma uns umas de do da dos das em no na nos nas num numa ao aos
   para pra por pelo pela pelos pelas com sem sobre entre ate desde apos depois antes
   e ou mas que se como quando onde porque pois entao tambem ja ainda so apenas
   muito pouco pouquinho mais menos bem tao meio quase todo toda todos todas
   eu me mim meu minha meus minhas comigo ele ela dele dela lhe nos nosso nossa
   voce vc te tu teu tua seu sua isso isto aquilo esse essa este esta aquele aquela
   aqui ali la ai agora hoje sim nao nada nenhum nenhuma outro outra
   disso disto daquilo nisso nesse nessa deste desta dele dela assim
   e sao esta estao estou estava estamos ser sou foi era eram sendo
   ter tem tenho tinha teve temos havia ha
   vai vou vamos ir fica ficou ficar fico faz fez fazer
   dar deu dei da poder pode posso queria`),
);

/**
 * Fórmulas sociais e de recusa: o único conteúdo que um ator pode produzir sem
 * citar fato algum. Fala clínica sem fato citado é rejeitada.
 */
const SOCIAL_LEXICON = new Set(
  tokens(`oi ola bom boa dia tarde noite tchau obrigado obrigada desculpa desculpe
   por favor ta tudo certo doutor doutora doutorzinho tio tia moco moca senhor senhora
   sei lembro lembra recordo conta contar disse falar falei perguntar pergunta responder
   acho parece talvez nunca aconteceu sabe entendi entendo ajuda ajudar
   mae mamae filho menino crianca nome anos idade`),
);

/** Afirmações que o ator não pode fazer, mesmo montadas com palavras autorizadas. */
const forbiddenClaimPatterns = [
  /vai (piorar|parar|precisar|melhorar)/,
  /pode (morrer|parar de respirar|intubar)/,
  /precisa (de|ser) (internad|intubad|uti)/,
  /o exame (mostrou|deu)/,
  /o resultado (foi|deu)/,
  /est(a|á) com \d+/,
  // A asma é da mãe: atribuí-la ao paciente é inversão de sentido, não paráfrase.
  /\b(ele|theo|meu filho|o menino|o guri) (tem|teve|esta com|ficou com|e) asma\b/,
];

export type ActorValidation =
  | { ok: true; reply: string; factIds: string[] }
  | { ok: false; reason: string; reply: string; factIds: string[] };

const FALLBACK: Record<SpeakingActor, string> = {
  theo: "Théo olha para você, respira com dificuldade e não responde nada além disso.",
  mae: "A mãe hesita: “Desculpa, isso eu não sei responder.”",
};

/** Palavras de conteúdo de um texto: nem função gramatical, nem fórmula social. */
function conteudo(texto: string): string[] {
  return tokens(texto).filter((t) => !STOPWORDS.has(t) && !SOCIAL_LEXICON.has(t));
}

/**
 * Valida a fala do ator contra os fatos que ela citou. Ver o contrato no topo
 * do arquivo. Falha fecha: qualquer violação devolve a fala de fallback.
 */
export function validateActorReply(
  actor: SpeakingActor,
  rawReply: string,
  rawIds: string[],
): ActorValidation {
  const allowed = factsForActor(actor);
  const byId = new Map(allowed.map((f) => [f.id, f]));
  const reply = (rawReply ?? "").trim();
  const fail = (reason: string): ActorValidation => ({
    ok: false,
    reason,
    reply: FALLBACK[actor],
    factIds: [],
  });

  if (!reply) return fail("resposta vazia");

  const ids = [...new Set(rawIds ?? [])];
  if (ids.some((id) => !byId.has(id))) return fail("ID de fato inexistente ou de outro ator");
  if (ids.length > MAX_FATOS_CITADOS)
    return fail(`mais de ${MAX_FATOS_CITADOS} fatos citados em uma única fala`);

  const t = norm(reply);
  const termo = forbiddenActorTerms.find((term) => t.includes(norm(term)));
  if (termo) return fail(`termo proibido para o ator: "${termo}"`);
  if (forbiddenClaimPatterns.some((re) => re.test(t)))
    return fail("afirmação clínica não sustentada pelos fatos autorizados");

  const conteudoDaFala = conteudo(reply);
  const numerosDaFala = tokens(reply).filter((x) => /^\d+$/.test(x));

  // Fala sem fato citado: só social ou recusa. Nada clínico.
  if (ids.length === 0) {
    if (conteudoDaFala.length > 0 || numerosDaFala.length > 0)
      return fail(`fala clínica sem fato citado: "${conteudoDaFala[0] ?? numerosDaFala[0]}"`);
    return { ok: true, reply, factIds: [] };
  }

  // Corpus autorizado = verbalizações dos fatos EFETIVAMENTE CITADOS.
  const citados = ids.map((id) => byId.get(id)!);
  const corpus = new Set(citados.flatMap((f) => verbalizacoesDe(f).flatMap(tokens)));

  const numeroForaDoCorpus = numerosDaFala.find((n) => !corpus.has(n));
  if (numeroForaDoCorpus)
    return fail(`número não sustentado pelos fatos citados: ${numeroForaDoCorpus}`);

  const palavraForaDoCorpus = conteudoDaFala.find((w) => !corpus.has(w));
  if (palavraForaDoCorpus)
    return fail(`conteúdo não sustentado pelos fatos citados: "${palavraForaDoCorpus}"`);

  // Cada fato citado precisa ter sido usado — citar sem usar é alargar corpus.
  const naFala = new Set(conteudoDaFala);
  const naoUsado = citados.find((f) => {
    const proprias = new Set(verbalizacoesDe(f).flatMap(conteudo));
    if (proprias.size === 0) return false;
    return ![...proprias].some((w) => naFala.has(w));
  });
  if (naoUsado) return fail(`fato citado sem uso na fala: ${naoUsado.id}`);

  return { ok: true, reply, factIds: ids };
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
    "Cada fato abaixo traz as VERBALIZAÇÕES AUTORIZADAS dele. Sua fala precisa ser montada com as palavras dessas verbalizações: você pode escolher uma, encurtá-la ou reordenar as palavras, mas NÃO pode introduzir palavra de conteúdo que não esteja lá.",
    `Cite em "factIds" os ids dos fatos que você usou — no máximo ${MAX_FATOS_CITADOS}, e apenas os que realmente aparecem na sua fala.`,
    'Se a pergunta não corresponder a nenhum fato, responda apenas com uma recusa curta ("não sei", "não lembro", "isso nunca aconteceu") e devolva "factIds" vazio. Uma fala com conteúdo clínico e factIds vazio é descartada.',
    "Nunca mencione saturação, frequências, ausculta, exames, aparelhos, medicamentos por nome técnico, diagnósticos ou o que vai acontecer depois.",
    "",
    "FATOS AUTORIZADOS:",
    ...facts.map(
      (f) =>
        `- [${f.id}] ${f.label}\n${verbalizacoesDe(f)
          .map((v) => `    · ${v}`)
          .join("\n")}`,
    ),
    "",
    'Devolva JSON com "reply" (sua fala) e "factIds" (os ids dos fatos usados; lista vazia se não usou nenhum).',
  ].join("\n");
}

/** Canal operacional da equipe — determinístico, sem LLM. */
export function teamReply(question: string): string {
  const t = norm(question);
  if (/oxig/.test(t))
    return "Equipe: temos cateter nasal, máscara facial e máscara com reservatório disponíveis. Informe dispositivo e fluxo.";
  if (/salbutamol|bombinha|inala|nebuli/.test(t))
    return "Equipe: temos salbutamol spray com espaçador e solução para nebulização. Informe a dose e a apresentação.";
  if (/monitor|oximet/.test(t))
    return "Equipe: o monitor está no leito; peça a verificação quando quiser.";
  if (/peso/.test(t)) return "Equipe: peso não foi aferido aqui; confirme com a mãe.";
  if (/exame|raio|gaso|hemograma/.test(t))
    return "Equipe: podemos coletar exames; a solicitação precisa dizer qual exame.";
  return "Equipe: pronta para executar o que for solicitado — descreva a ação completa.";
}
