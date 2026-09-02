/**
 * Emissão controlada da fala dos atores.
 *
 * O modelo NÃO escreve para o estudante. Ele apenas **escolhe** entre
 * verbalizações autorizadas: devolve `factId` + `verbalizacaoId`, e o servidor
 * monta a resposta exclusivamente com o texto completo dessas verbalizações.
 * Fala social e recusa também vêm de catálogo fixo (`falasSociais`).
 *
 * Por que isto substituiu a validação lexical: a validação anterior conferia
 * palavra por palavra contra os fatos citados, o que limitava vocabulário e
 * não semântica. O fato "Nunca precisou ficar internado" autoriza todas as
 * palavras de "Ele ficou internado" — a negação simplesmente desaparecia. Não
 * é possível enumerar as inversões clínicas com regex, e tentar isso foi o
 * erro do desenho anterior. Aqui a inversão não é detectada: ela é impossível,
 * porque nenhuma prosa clínica do modelo chega ao estudante.
 *
 * Custo aceito: menos variedade de fala. Ganho: o que se afirma garantir é o
 * que o código garante, e o pediatra revisa exatamente as 2 a 3 verbalizações
 * de cada fato.
 */

import {
  falasSociais,
  gatilhosSensiveis,
  maeFacts,
  recusaPadrao,
  theoFacts,
  verbalizacoesDe,
  type ActorFact,
} from "./case-theo";

export type SpeakingActor = "theo" | "mae";

/** Uma fala tem no máximo 3 frases; mais que isso não é fala de paciente. */
export const MAX_VERBALIZACOES = 3;

export function factsForActor(actor: SpeakingActor): ActorFact[] {
  return actor === "theo" ? theoFacts : maeFacts;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Id estável de verbalização: `<factId>#<índice>`, índice 0 = `content`. */
export function verbalizacaoId(factId: string, indice: number) {
  return `${factId}#${indice}`;
}

type Entrada = { id: string; texto: string; factId: string | null; sensitive: boolean };

/** Catálogo completo de emissão de um ator: verbalizações de fato + falas sociais. */
export function catalogoDe(actor: SpeakingActor): Entrada[] {
  const deFatos = factsForActor(actor).flatMap((f) =>
    verbalizacoesDe(f).map((texto, i) => ({
      id: verbalizacaoId(f.id, i),
      texto,
      factId: f.id,
      sensitive: f.sensitive === true,
    })),
  );
  const sociais = falasSociais[actor].map((s) => ({
    id: s.id,
    texto: s.texto,
    factId: null,
    sensitive: false,
  }));
  return [...deFatos, ...sociais];
}

/** A pergunta do estudante alcança este fato sensível de forma direta? */
export function perguntaLiberaFato(factId: string, pergunta: string): boolean {
  const gatilhos = gatilhosSensiveis[factId];
  if (!gatilhos) return true; // fato não sensível: sem porta
  const p = norm(pergunta);
  return gatilhos.some((g) => p.includes(norm(g)));
}

/** Fatos que podem ser enviados ao modelo nesta pergunta. */
export function fatosLiberados(actor: SpeakingActor, pergunta: string): ActorFact[] {
  return factsForActor(actor).filter(
    (f) => f.sensitive !== true || perguntaLiberaFato(f.id, pergunta),
  );
}

export type SelecaoBruta = { factId?: unknown; verbalizacaoId?: unknown };

export type Emissao = {
  ok: boolean;
  reply: string;
  factIds: string[];
  verbalizacaoIds: string[];
  reason?: string;
};

const FALLBACK: Record<SpeakingActor, string> = {
  theo: "Théo olha para você, respira com dificuldade e não responde nada além disso.",
  mae: "A mãe hesita: “Desculpa, isso eu não sei responder.”",
};

/**
 * Monta a fala do ator a partir das seleções do modelo.
 *
 * Só sai daqui texto que já estava autorizado no catálogo. Qualquer seleção
 * inválida — id inexistente, id de outro ator, `factId` incoerente com a
 * verbalização, fato sensível sem pergunta compatível, excesso de seleções —
 * descarta a fala inteira e devolve o fallback determinístico.
 */
export function emitirFala(
  actor: SpeakingActor,
  selecoes: SelecaoBruta[] | undefined,
  pergunta: string,
): Emissao {
  const catalogo = catalogoDe(actor);
  const porId = new Map(catalogo.map((e) => [e.id, e]));
  const falha = (reason: string): Emissao => ({
    ok: false,
    reply: FALLBACK[actor],
    factIds: [],
    verbalizacaoIds: [],
    reason,
  });

  const lista = Array.isArray(selecoes) ? selecoes : [];

  // Nada selecionado não é violação: é o ator não tendo o que dizer.
  if (lista.length === 0)
    return { ok: true, reply: recusaPadrao[actor], factIds: [], verbalizacaoIds: [] };

  if (lista.length > MAX_VERBALIZACOES)
    return falha(`mais de ${MAX_VERBALIZACOES} verbalizações em uma única fala`);

  const escolhidas: Entrada[] = [];
  for (const sel of lista) {
    const vid = typeof sel?.verbalizacaoId === "string" ? sel.verbalizacaoId : "";
    const entrada = porId.get(vid);
    if (!entrada) return falha(`verbalização inexistente ou de outro ator: "${vid}"`);

    const fid = typeof sel?.factId === "string" ? sel.factId : null;
    if (fid !== null && fid !== "" && fid !== entrada.factId)
      return falha(`factId "${fid}" incoerente com a verbalização "${vid}"`);

    if (entrada.sensitive && entrada.factId && !perguntaLiberaFato(entrada.factId, pergunta))
      return falha(`fato sensível sem pergunta direta compatível: ${entrada.factId}`);

    if (!escolhidas.some((e) => e.id === entrada.id)) escolhidas.push(entrada);
  }

  return {
    ok: true,
    reply: escolhidas.map((e) => e.texto).join(" "),
    factIds: [...new Set(escolhidas.flatMap((e) => (e.factId ? [e.factId] : [])))],
    verbalizacaoIds: escolhidas.map((e) => e.id),
  };
}

/**
 * Prompt do ator: recebe SOMENTE os fatos liberados para esta pergunta e pede
 * ids, nunca texto. O modelo é um selecionador, não um redator.
 */
export function buildActorPrompt(actor: SpeakingActor, pergunta: string): string {
  const facts = fatosLiberados(actor, pergunta);
  const persona =
    actor === "theo"
      ? "Você é Théo, uma criança de 6 anos com falta de ar, no pronto-socorro. Você NÃO sabe nada sobre exames, aparelhos, números ou nomes de doenças."
      : "Você é a mãe do Théo, 34 anos, preocupada. Você conhece a história do filho e as crises anteriores. Você NÃO sabe resultados de exames, valores de aparelhos, achados de ausculta nem o nome técnico do que ele tem.";

  const opcoes = facts.flatMap((f) =>
    verbalizacoesDe(f).map((v, i) => `- ${verbalizacaoId(f.id, i)} (${f.label}): "${v}"`),
  );
  const sociais = falasSociais[actor].map((s) => `- ${s.id}: "${s.texto}"`);

  return [
    persona,
    "Você NÃO escreve a resposta. Você SELECIONA, entre as falas autorizadas abaixo, aquela ou aquelas que respondem à pergunta do estudante. O sistema é que entrega o texto.",
    `Devolva de 1 a ${MAX_VERBALIZACOES} seleções, em JSON, no campo "selecoes": cada item com "factId" (o id do fato, ou string vazia para fala social) e "verbalizacaoId" (o id exato da linha escolhida).`,
    "Se nenhuma fala autorizada responde à pergunta, selecione uma das falas sociais de recusa. Nunca invente texto: texto inventado é descartado e não chega ao estudante.",
    "",
    "FALAS AUTORIZADAS (fatos):",
    ...opcoes,
    "",
    "FALAS AUTORIZADAS (social e recusa):",
    ...sociais,
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
