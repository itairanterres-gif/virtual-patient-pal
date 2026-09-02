/**
 * Caso canônico "dispneia-crianca" — Théo R., 6 anos.
 *
 * Contém APENAS a verdade clínica canônica e a configuração fisiológica.
 * Nenhuma lógica de execução vive aqui (ver theo-engine.ts) e nenhum LLM
 * decide fisiologia, execução, consequência ou correção.
 */

export type TheoActor = "theo" | "mae" | "equipe";

/** Escopo do fato: do próprio paciente, de familiar ou contexto. */
export type FactScope = "paciente" | "familiar" | "contexto";

export type ActorFact = {
  id: string;
  actor: Exclude<TheoActor, "equipe">;
  scope: FactScope;
  label: string;
  /** Único texto que o ator pode verbalizar sobre este fato. */
  content: string;
  sensitive?: boolean;
};

export type ObjectiveFact = {
  id: string;
  label: string;
  content: string;
  source: "exame_fisico" | "exame_complementar" | "diagnostico";
  /** Palavras que, ditas pelo estudante, correspondem a esta avaliação. */
  keywords: string[];
};

export const THEO_CASE_ID = "dispneia-crianca";

/** Identidade curricular, proveniência e curadoria. */
export const theoProvenance = {
  caseId: THEO_CASE_ID,
  titulo: "Dispneia aguda em criança de 6 anos",
  curriculo: [
    "Pediatria — urgência respiratória",
    "ENAMED: reconhecimento de gravidade e conduta inicial",
  ],
  competencias: [
    "Reconhecer sinais de gravidade respiratória em pediatria",
    "Comunicar-se separadamente com a criança e com o acompanhante",
    "Prescrever intervenção completa (dose, via, dispositivo, alvo)",
    "Reavaliar após intervenção e transferir o cuidado com passagem estruturada",
  ],
  autoria: "Equipe Vitalis·Sim (rascunho gerado com apoio de IA)",
  versao: "0.2.0-theo",
  revisadoPor: null as string | null,
  statusCuracao: "provisorio" as "provisorio" | "em_revisao" | "aprovado",
  avisoCuracao:
    "Conteúdo clínico PROVISÓRIO, sem validação humana. Não liberar a estudantes antes da aprovação por pediatra responsável.",
};

/** Fatos que Théo (6 anos) pode verbalizar: sensações, medos, vivência. */
export const theoFacts: ActorFact[] = [
  {
    id: "t-peito",
    actor: "theo",
    scope: "paciente",
    label: "Sensação torácica",
    content: "Meu peito fica apertado, parece que tem alguém apertando.",
  },
  {
    id: "t-cansaco-fala",
    actor: "theo",
    scope: "paciente",
    label: "Cansaço ao falar",
    content: "Cansa falar muito, eu tenho que parar no meio.",
  },
  {
    id: "t-tosse",
    actor: "theo",
    scope: "paciente",
    label: "Tosse",
    content: "Eu tossi muito à noite e não consegui dormir direito.",
  },
  {
    id: "t-chiado",
    actor: "theo",
    scope: "paciente",
    label: "Chiado percebido",
    content: "Sai um barulhinho de apito quando eu solto o ar.",
  },
  {
    id: "t-brincar",
    actor: "theo",
    scope: "paciente",
    label: "Limitação para brincar",
    content: "Hoje eu não consegui correr no recreio, fiquei sentado.",
  },
  {
    id: "t-bombinha",
    actor: "theo",
    scope: "paciente",
    label: "Bombinha em casa",
    content: "A mamãe deu a bombinha, mas eu ainda estou cansado.",
  },
  {
    id: "t-medo-mascara",
    actor: "theo",
    scope: "paciente",
    label: "Medo da máscara",
    content: "Eu não gosto de máscara no rosto, ela me dá medo.",
    sensitive: true,
  },
  {
    id: "t-medo-agulha",
    actor: "theo",
    scope: "paciente",
    label: "Medo de agulha",
    content: "Vai furar meu braço? Eu tenho medo de agulha.",
    sensitive: true,
  },
  {
    id: "t-quer-mae",
    actor: "theo",
    scope: "paciente",
    label: "Necessidade de acolhimento",
    content: "Quero ficar de mão dada com a minha mãe.",
  },
  {
    id: "t-sem-dor-barriga",
    actor: "theo",
    scope: "paciente",
    label: "Ausência de dor abdominal",
    content: "Minha barriga não dói, não.",
  },
];

/** Fatos que a mãe conhece: história temporal, tratamento domiciliar, crises, preocupações. */
export const maeFacts: ActorFact[] = [
  {
    id: "m-inicio",
    actor: "mae",
    scope: "paciente",
    label: "Início do quadro",
    content: "Começou com coriza há três dias e ontem à noite ele começou a chiar.",
  },
  {
    id: "m-piora-noite",
    actor: "mae",
    scope: "paciente",
    label: "Padrão de piora",
    content: "Piora muito de madrugada e quando ele corre.",
  },
  {
    id: "m-salbutamol-casa",
    actor: "mae",
    scope: "paciente",
    label: "Tratamento domiciliar",
    content:
      "Dei a bombinha de salbutamol em casa duas vezes, a última há mais ou menos duas horas, e melhorou pouquinho.",
  },
  {
    id: "m-crises-anteriores",
    actor: "mae",
    scope: "paciente",
    label: "Crises anteriores",
    content: "Ele já teve quatro crises parecidas no último ano; a última foi há uns quatro meses.",
  },
  {
    id: "m-internacao",
    actor: "mae",
    scope: "paciente",
    label: "Internações prévias",
    content: "Nunca precisou ficar internado nem ir para a UTI.",
  },
  {
    id: "m-sem-manutencao",
    actor: "mae",
    scope: "paciente",
    label: "Tratamento de manutenção",
    content: "Ele não usa nenhuma bombinha todo dia, só quando fica ruim.",
  },
  {
    id: "m-rinite",
    actor: "mae",
    scope: "paciente",
    label: "Antecedente pessoal — rinite",
    content: "Ele tem rinite alérgica, vive com o nariz entupido, principalmente com poeira.",
  },
  {
    id: "m-sem-febre",
    actor: "mae",
    scope: "paciente",
    label: "Febre",
    content: "Não teve febre, eu medi em casa e estava normal.",
  },
  {
    id: "m-alergia-medicamento",
    actor: "mae",
    scope: "paciente",
    label: "Alergias medicamentosas",
    content: "Ele não tem alergia a remédio nenhum que a gente saiba.",
  },
  {
    id: "m-vacinas",
    actor: "mae",
    scope: "paciente",
    label: "Vacinação",
    content: "As vacinas dele estão todas em dia.",
  },
  {
    id: "m-peso",
    actor: "mae",
    scope: "paciente",
    label: "Peso informado",
    content: "Ele pesou 22 quilos na última consulta.",
  },
  {
    id: "m-escola",
    actor: "mae",
    scope: "contexto",
    label: "Contexto ambiental",
    content: "Tem colega resfriado na escola e em casa a gente tem gato.",
  },
  {
    id: "m-asma-materna",
    actor: "mae",
    scope: "familiar",
    label: "Antecedente FAMILIAR — asma da mãe (não do paciente)",
    content:
      "Quem tem asma sou eu, a mãe, desde criança. Isso é comigo, não com ele; ele nunca recebeu esse nome de nenhum médico.",
  },
  {
    id: "m-preocupacao",
    actor: "mae",
    scope: "contexto",
    label: "Preocupação",
    content: "Estou com muito medo, nunca vi ele cansado desse jeito.",
    sensitive: true,
  },
  {
    id: "m-culpa",
    actor: "mae",
    scope: "contexto",
    label: "Sentimento de culpa",
    content: "Fico achando que demorei demais para trazer ele.",
    sensitive: true,
  },
];

export const theoActorFacts: ActorFact[] = [...theoFacts, ...maeFacts];

/**
 * Verbalizações clínicas autorizadas, por fato, ALÉM do próprio `content`.
 *
 * O grounding aceita apenas palavras que apareçam nas verbalizações dos fatos
 * EFETIVAMENTE CITADOS pelo ator naquela fala. Esta tabela existe para que a
 * fala soe natural sem abrir a porta para invenção: cada variante é uma
 * reformulação do mesmo fato, sem acrescentar informação clínica nova.
 *
 * Fica separada dos fatos de propósito — a verdade canônica em `theoFacts` e
 * `maeFacts` não é alterada por decisão de redação, e esta tabela pode ser
 * revisada isoladamente pelo pediatra responsável.
 */
export const verbalizacoesAutorizadas: Record<string, string[]> = {
  // ---------------------------------------------------------------- Théo
  "t-peito": ["Fica apertado aqui no peito.", "Parece que alguém aperta o meu peito."],
  "t-cansaco-fala": [
    "Cansa falar.",
    "Eu tenho que parar no meio para respirar.",
    "Falar muito me cansa.",
  ],
  "t-tosse": ["Tossi muito de noite.", "Não consegui dormir porque eu tossia muito."],
  "t-chiado": [
    "Faz um apito quando eu solto o ar.",
    "Sai um barulhinho quando eu respiro.",
    "Tem um apito no meu peito.",
  ],
  "t-brincar": [
    "No recreio eu fiquei sentado.",
    "Hoje eu não consegui correr.",
    "Não deu para brincar.",
  ],
  "t-bombinha": [
    "A mamãe deu a bombinha em casa.",
    "Mesmo com a bombinha eu continuo cansado.",
    "Já usei a bombinha.",
  ],
  "t-medo-mascara": [
    "Não quero máscara no rosto.",
    "A máscara me dá medo.",
    "Tenho medo dessa máscara.",
  ],
  "t-medo-agulha": ["Tenho medo de agulha.", "Você vai furar o meu braço?"],
  "t-quer-mae": [
    "Quero a minha mãe aqui.",
    "Deixa eu ficar de mão dada com a mamãe.",
    "Quero a mamãe perto.",
  ],
  "t-sem-dor-barriga": ["A minha barriga não dói.", "Não dói nada na barriga."],

  // ----------------------------------------------------------------- mãe
  "m-inicio": [
    "Começou com coriza há três dias.",
    "Ontem à noite ele começou a chiar.",
    "Faz três dias que começou, com coriza, e o chiado veio ontem à noite.",
  ],
  "m-piora-noite": [
    "Piora de madrugada.",
    "Piora muito quando ele corre.",
    "De madrugada e correndo é quando piora.",
  ],
  "m-salbutamol-casa": [
    "Dei a bombinha de salbutamol em casa duas vezes.",
    "A última bombinha foi há mais ou menos duas horas.",
    "Melhorou pouquinho com a bombinha.",
  ],
  "m-crises-anteriores": [
    "Ele já teve quatro crises parecidas no último ano.",
    "A última crise foi há uns quatro meses.",
  ],
  "m-internacao": [
    "Ele nunca ficou internado.",
    "Nunca precisou ir para a UTI.",
    "Nunca precisou internar por isso.",
  ],
  "m-sem-manutencao": [
    "Ele não usa bombinha todo dia.",
    "Só usa quando fica ruim.",
    "Não tem nada de uso contínuo.",
  ],
  "m-rinite": [
    "Ele tem rinite alérgica.",
    "Vive com o nariz entupido.",
    "Com poeira o nariz dele fecha.",
  ],
  "m-sem-febre": ["Não teve febre.", "Eu medi em casa e estava normal.", "Febre ele não teve."],
  "m-alergia-medicamento": [
    "Ele não tem alergia a remédio nenhum.",
    "Que a gente saiba, nenhuma alergia a remédio.",
  ],
  "m-vacinas": ["As vacinas estão em dia.", "A vacinação dele está toda em dia."],
  "m-peso": ["Ele pesou 22 quilos na última consulta.", "O peso dele é 22 quilos."],
  "m-escola": [
    "Tem colega resfriado na escola.",
    "Em casa a gente tem gato.",
    "Na escola tem criança resfriada e em casa tem gato.",
  ],
  "m-asma-materna": [
    "Quem tem asma sou eu, a mãe.",
    "Isso é comigo, não com ele.",
    "Ele nunca recebeu esse nome de nenhum médico.",
  ],
  "m-preocupacao": [
    "Estou com muito medo.",
    "Nunca vi ele cansado desse jeito.",
    "Estou assustada com ele assim.",
  ],
  "m-culpa": [
    "Fico achando que demorei demais para trazer ele.",
    "Sinto que eu devia ter trazido antes.",
  ],
};

/**
 * Liberação de fatos sensíveis: só saem se o estudante perguntar de forma
 * direta e compatível. Validado NO SERVIDOR, não no prompt — e o fato nem é
 * enviado ao modelo enquanto não estiver liberado.
 *
 * Medo, culpa e preocupação são vivência, não dado clínico a colher: o
 * simulador não deve entregá-los a quem não perguntou.
 */
export const gatilhosSensiveis: Record<string, string[]> = {
  "t-medo-mascara": [
    "medo",
    "mascara",
    "assust",
    "incomod",
    "nao gosta",
    "aceita",
    "colocar no rosto",
    "tem vergonha",
  ],
  "t-medo-agulha": ["medo", "agulha", "injec", "picada", "furar", "espetar", "sangue no braco"],
  "m-preocupacao": [
    "preocup",
    "medo",
    "assust",
    "como voce esta",
    "como a senhora esta",
    "o que a senhora sente",
    "esta se sentindo",
    "angusti",
    "nervos",
  ],
  "m-culpa": [
    "culpa",
    "demor",
    "antes",
    "tarde",
    "se cobra",
    "acha que",
    "responsavel",
    "poderia ter",
  ],
};

/**
 * Catálogo fixo de fala social e de recusa. Nenhuma prosa social vem do
 * modelo: ele escolhe um id daqui, como escolhe uma verbalização de fato.
 */
export const falasSociais: Record<Exclude<TheoActor, "equipe">, { id: string; texto: string }[]> = {
  theo: [
    { id: "social:theo:nao-sei", texto: "Não sei." },
    { id: "social:theo:nao-lembro", texto: "Não lembro." },
    { id: "social:theo:nunca", texto: "Isso nunca aconteceu." },
    { id: "social:theo:oi", texto: "Oi." },
    { id: "social:theo:silencio", texto: "Théo olha para você e não responde." },
    { id: "social:theo:nao-quero-falar", texto: "Não quero falar disso agora." },
  ],
  mae: [
    { id: "social:mae:nao-sei", texto: "Isso eu não sei responder." },
    { id: "social:mae:nao-lembro", texto: "Não lembro direito, doutor." },
    { id: "social:mae:nunca", texto: "Isso nunca aconteceu." },
    { id: "social:mae:boa-tarde", texto: "Boa tarde, doutor." },
    { id: "social:mae:obrigada", texto: "Obrigada." },
    { id: "social:mae:prefiro-nao", texto: "Prefiro não falar disso agora." },
  ],
};

/** Recusa padrão de cada ator, usada quando o modelo não seleciona nada. */
export const recusaPadrao: Record<Exclude<TheoActor, "equipe">, string> = {
  theo: "Não sei.",
  mae: "Isso eu não sei responder.",
};

/** Todas as verbalizações autorizadas de um fato, incluindo o `content` canônico. */
export function verbalizacoesDe(fact: ActorFact): string[] {
  return [fact.content, ...(verbalizacoesAutorizadas[fact.id] ?? [])];
}

/** Verdade objetiva — obtida só por avaliação/exame. Nunca enviada a Théo ou à mãe. */
export const theoObjectiveFacts: ObjectiveFact[] = [
  {
    id: "o-geral",
    label: "Estado geral",
    content: "Criança sentada, inclinada para frente, alerta, ansiosa, recusa deitar",
    source: "exame_fisico",
    keywords: ["estado geral", "aspecto", "inspe", "geral", "olhar", "observ"],
  },
  {
    id: "o-esforco",
    label: "Esforço respiratório",
    content:
      "Tiragem intercostal e subcostal, batimento de asa de nariz, uso de musculatura acessória",
    source: "exame_fisico",
    keywords: ["esforço", "esforco", "tiragem", "retração", "retracao", "musculatura", "respirat"],
  },
  {
    id: "o-ausculta",
    label: "Ausculta pulmonar",
    content:
      "Sibilos expiratórios difusos bilaterais, tempo expiratório prolongado, entrada de ar reduzida em bases",
    source: "exame_fisico",
    keywords: ["ausculta", "pulm", "torax", "tórax", "estetos", "respira", "sibil"],
  },
  {
    id: "o-cardio",
    label: "Ausculta cardíaca",
    content: "Taquicárdico, ritmo regular em dois tempos, sem sopros",
    source: "exame_fisico",
    keywords: ["cardíac", "cardiac", "coração", "coracao", "precord", "sopro"],
  },
  {
    id: "o-perfusao",
    label: "Perfusão periférica",
    content: "Enchimento capilar 2 s, extremidades aquecidas, pulsos cheios",
    source: "exame_fisico",
    keywords: ["perfus", "enchimento", "capilar", "extremidade", "pulso"],
  },
  {
    id: "o-orl",
    label: "Oroscopia e rinoscopia",
    content: "Mucosa nasal pálida com secreção clara, orofaringe sem exsudato",
    source: "exame_fisico",
    keywords: ["orofaringe", "garganta", "nariz", "oroscop", "otoscop", "ouvido", "rinoscop"],
  },
  {
    id: "o-abdome",
    label: "Abdome",
    content: "Flácido, indolor, sem visceromegalias",
    source: "exame_fisico",
    keywords: ["abdome", "abdomin", "barriga"],
  },
  {
    id: "o-pele",
    label: "Pele e coloração",
    content: "Sem cianose central, pele levemente sudoreica",
    source: "exame_fisico",
    keywords: ["pele", "cianose", "coloração", "coloracao", "sudore"],
  },
  {
    id: "o-rx",
    label: "Radiografia de tórax",
    content: "Hiperinsuflação pulmonar, sem consolidações",
    source: "exame_complementar",
    keywords: ["raio", "radiograf", "rx", "tórax", "torax"],
  },
  {
    id: "o-gaso",
    label: "Gasometria arterial",
    content: "pH 7,42 · pCO₂ 34 mmHg · pO₂ 68 mmHg",
    source: "exame_complementar",
    keywords: ["gasometria", "gaso"],
  },
  {
    id: "o-hemograma",
    label: "Hemograma",
    content: "Sem leucocitose, eosinofilia discreta",
    source: "exame_complementar",
    keywords: ["hemograma", "sangue", "laborat"],
  },
  {
    id: "o-diagnostico",
    label: "Diagnóstico canônico",
    content:
      "Crise de asma moderada a grave desencadeada por infecção viral de vias aéreas superiores",
    source: "diagnostico",
    keywords: [],
  },
];

/** Termos que jamais podem aparecer na fala de Théo ou da mãe. */
export const forbiddenActorTerms = [
  "spo2",
  "spo₂",
  "saturação",
  "saturacao",
  "oximet",
  "sibil",
  "ausculta",
  "tiragem",
  "murmúrio",
  "murmurio",
  "broncoespasmo",
  "hipoxemia",
  "insuficiência respiratória",
  "insuficiencia respiratoria",
  "gasometria",
  "radiografia",
  "raio-x",
  "raio x",
  "hemograma",
  "diagnóstico",
  "diagnostico",
  "crise asmática",
  "crise asmatica",
  "frequência respiratória",
  "frequencia respiratoria",
  "frequência cardíaca",
  "frequencia cardiaca",
  "bpm",
  "irpm",
  "mmhg",
  "mg/kg",
  "ml/kg",
  "l/min",
  "salbutamol inalatório",
  "prednisolona",
  "ipratrópio",
  "ipratropio",
  "corticoide",
  "nebulização",
  "nebulizacao",
  "intubação",
  "intubacao",
  "uti pediátrica",
];

export const theoBaseline = {
  spo2: 92,
  hr: 132,
  rr: 38,
  speech: "frases_curtas",
  effort: "moderado",
  airEntry: "reduzida",
  wheeze: "moderada",
  oximeterSignal: "instavel",
} as const;

/** Eventos independentes (segundos de tempo clínico). */
export const theoTimeline = {
  hypoxemiaAt: 6 * 60,
  criticalEffortAt: 10 * 60,
  safetyEscalationAt: 14 * 60,
} as const;

/** Latências determinísticas (segundos de tempo clínico). */
export const theoLatency = {
  oxygenPrep: 30,
  oxygenExec: 10,
  oxygenOnset: 30,
  inhaledPrep: 45,
  inhaledExec: 15,
  inhaledOnset: 60,
  oralPrep: 60,
  oralExec: 10,
  genericPrep: 20,
  genericExec: 10,
  examDuration: 15,
  testTurnaround: 240,
  /**
   * Duração clínica de uma pergunta–resposta concluída com Théo, com a mãe ou
   * com a equipe. É configuração do caso: NUNCA derivada da duração real da
   * chamada ao modelo, do tempo de digitação nem de quanto a página ficou
   * aberta. Trinta segundos por troca é o que aproxima uma pergunta dirigida
   * e a resposta correspondente à beira do leito.
   */
  conversationDuration: 30,
} as const;

/**
 * Compromisso diagnóstico antes do dado — CONFIGURAÇÃO DESTE CASO, não regra
 * do motor.
 *
 * A decisão pedagógica é "compromisso antes do exame DECISIVO". Presumir que
 * todo exame complementar seja decisivo criaria regra artificial justamente
 * aqui: a crise do Théo se avalia clinicamente, e radiografia, gasometria e
 * hemograma não decidem o diagnóstico dele. Por isso a lista está vazia — a
 * capacidade existe, fica desligada neste caso, e cada caso futuro declara os
 * seus exames decisivos por chave de `TEST_MAP` (radiografia, gasometria,
 * hemograma).
 */
export const theoGating = {
  examesDecisivos: [] as string[],
};

/**
 * O tempo clínico é DISCRETO e orientado por eventos: não existe fator de
 * conversão para o tempo real, porque não há relógio de parede no encontro.
 * O relógio só avança quando uma ação clínica consome duração — conversa,
 * exame físico, reavaliação ou espera explícita. Página aberta, leitura,
 * digitação, latência do modelo e aba suspensa não avançam nada.
 */
