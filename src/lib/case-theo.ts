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
} as const;

/** 1 segundo real = 5 segundos de tempo clínico. */
export const THEO_CLOCK_FACTOR = 5;
