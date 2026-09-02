/**
 * Motor clínico determinístico do caso canônico do Théo (dispneia-crianca).
 *
 * Regras invioláveis:
 * - Tempo, fisiologia, execução e consequência pertencem ao motor (nunca ao React, nunca ao LLM).
 * - Toda intervenção segue: proposta → esclarecimento (se incompleta) → confirmação → preparo → execução → efeito.
 * - Nada acontece antes da confirmação explícita.
 * - O mesmo log de ações produz sempre o mesmo estado final.
 * - Sem nota numérica.
 */

import {
  THEO_CLOCK_FACTOR,
  theoBaseline,
  theoGating,
  theoLatency,
  theoObjectiveFacts,
  theoTimeline,
  type ObjectiveFact,
} from "./case-theo";

export { THEO_CLOCK_FACTOR };

export type Speech = "frases" | "frases_curtas" | "palavras" | "monossilabos";
export type Effort = "leve" | "moderado" | "grave" | "critico";
export type AirEntry = "normal" | "reduzida" | "muito_reduzida" | "criticamente_reduzida";
export type Wheeze = "ausente" | "leve" | "moderada" | "intensa" | "silencio";
export type Signal = "bom" | "instavel" | "ruim";

const SPEECH: Speech[] = ["frases", "frases_curtas", "palavras", "monossilabos"];
const EFFORT: Effort[] = ["leve", "moderado", "grave", "critico"];
const AIR: AirEntry[] = ["normal", "reduzida", "muito_reduzida", "criticamente_reduzida"];
const WHEEZE: Wheeze[] = ["ausente", "leve", "moderada", "intensa", "silencio"];

export const SPEECH_LABEL: Record<Speech, string> = {
  frases: "fala frases completas",
  frases_curtas: "fala frases curtas",
  palavras: "fala palavras isoladas",
  monossilabos: "monossílabos",
};
export const EFFORT_LABEL: Record<Effort, string> = {
  leve: "esforço leve",
  moderado: "esforço moderado",
  grave: "esforço grave",
  critico: "esforço crítico",
};
export const AIR_LABEL: Record<AirEntry, string> = {
  normal: "entrada de ar normal",
  reduzida: "entrada de ar reduzida",
  muito_reduzida: "entrada de ar muito reduzida",
  criticamente_reduzida: "entrada de ar criticamente reduzida",
};
export const WHEEZE_LABEL: Record<Wheeze, string> = {
  ausente: "sem sibilância",
  leve: "sibilância leve",
  moderada: "sibilância moderada",
  intensa: "sibilância intensa",
  silencio: "silêncio auscultatório",
};

const better = <T>(scale: T[], v: T, steps = 1): T => scale[Math.max(0, scale.indexOf(v) - steps)]!;
const worse = <T>(scale: T[], v: T, steps = 1): T =>
  scale[Math.min(scale.length - 1, scale.indexOf(v) + steps)]!;

export type Vitals = {
  spo2: number;
  hr: number;
  rr: number;
  speech: Speech;
  effort: Effort;
  airEntry: AirEntry;
  wheeze: Wheeze;
  oximeterSignal: Signal;
};

export type EventType =
  | "observacao"
  | "decisao"
  | "esclarecimento"
  | "confirmacao"
  | "execucao"
  | "efeito"
  | "evento_independente"
  | "comunicacao"
  | "transferencia"
  | "raciocinio";

export type CausalEvent = {
  id: string;
  atSec: number;
  type: EventType;
  label: string;
  detail?: string | undefined;
  /** Evento que originou este evento (cadeia causal). */
  causeId?: string | undefined;
  orderId?: string | undefined;
  actor?: string | undefined;
  tone?: "normal" | "warn" | "crit" | undefined;
};

export type OrderKind =
  "oxigenio" | "medicamento" | "exame" | "monitorizacao" | "acesso" | "posicionamento";

export type Drug = "salbutamol" | "ipratropio" | "prednisolona";

export type OrderStatus =
  | "aguardando_esclarecimento"
  | "aguardando_confirmacao"
  | "preparo"
  | "execucao"
  | "concluida"
  | "cancelada";

export type OrderFields = {
  dose?: string | undefined;
  via?: string | undefined;
  device?: string | undefined;
  flow?: string | undefined;
  target?: string | undefined;
  test?: string | undefined;
};

export type Order = {
  id: string;
  kind: OrderKind;
  drug?: Drug | undefined;
  raw: string;
  label: string;
  fields: OrderFields;
  missing: string[];
  status: OrderStatus;
  createdAtSec: number;
  confirmedAtSec?: number | undefined;
  execStartSec?: number | undefined;
  doneSec?: number | undefined;
  effectSec?: number | undefined;
  resultSec?: number | undefined;
  resultFactIds?: string[] | undefined;
};

/**
 * DECISÃO PEDAGÓGICA PENDENTE — ver DECISOES-PENDENTES.md, item 1.
 *
 * Ordinal de três níveis é provisório. A decisão acordada é coletar a confiança
 * de forma comparável à do Treino ENAMED (autorrelato para calcular calibração
 * depois — não é nota e não afirma correção). Não trocar antes de confirmar a
 * escala de lá: mudar duas vezes invalida o que o piloto já tiver coletado.
 */
export type Confianca = "baixa" | "media" | "alta";

export const CONFIANCA_LABEL: Record<Confianca, string> = {
  baixa: "confiança baixa",
  media: "confiança média",
  alta: "confiança alta",
};

/**
 * Representação do problema, diferenciais e confiança, declarados ANTES do
 * exame complementar. O motor registra o que foi expresso e quando; a
 * qualidade semântica (a representação está correta? os diferenciais são
 * pertinentes? a confiança está calibrada?) NÃO é avaliada automaticamente.
 */
export type ReasoningEntry = {
  atSec: number;
  representacao: string;
  diferenciais: string[];
  confianca: Confianca;
};

export const REPRESENTACAO_MIN_CARACTERES = 30;
export const DIFERENCIAIS_MIN = 2;

export function avaliarRaciocinio(
  representacao: string,
  diferenciais: string[],
  confianca: Confianca,
): string[] {
  const faltas: string[] = [];
  const r = representacao.trim();
  if (r.length < REPRESENTACAO_MIN_CARACTERES)
    faltas.push(
      `representação do problema com pelo menos ${REPRESENTACAO_MIN_CARACTERES} caracteres (há ${r.length})`,
    );
  const d = diferenciais.map((x) => x.trim()).filter(Boolean);
  if (d.length < DIFERENCIAIS_MIN)
    faltas.push(`ao menos ${DIFERENCIAIS_MIN} diagnósticos diferenciais (há ${d.length})`);
  if (!["baixa", "media", "alta"].includes(confianca)) faltas.push("grau de confiança");
  return faltas;
}

export type TheoState = {
  clockSec: number;
  vitals: Vitals;
  orders: Order[];
  log: CausalEvent[];
  revealedObjective: string[];
  transfer: { destino: string; passagem: string; atSec: number } | null;
  reasoning: ReasoningEntry[];
  frozen: boolean;
  safetyEscalation: boolean;
  triggered: string[];
  seq: number;
};

export function createTheoState(): TheoState {
  return {
    clockSec: 0,
    vitals: { ...theoBaseline },
    orders: [],
    log: [
      {
        id: "e0",
        atSec: 0,
        type: "evento_independente",
        label: "Início do atendimento",
        detail:
          "Théo R., 6 anos, chega ao pronto-socorro pediátrico acompanhado pela mãe, com dificuldade para respirar.",
        tone: "warn",
      },
    ],
    revealedObjective: [],
    transfer: null,
    reasoning: [],
    frozen: false,
    safetyEscalation: false,
    triggered: [],
    seq: 1,
  };
}

export function clockLabel(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function push(
  s: TheoState,
  e: Omit<CausalEvent, "id" | "atSec"> & { atSec?: number },
): CausalEvent {
  const ev: CausalEvent = { id: `e${s.seq++}`, atSec: e.atSec ?? s.clockSec, ...e };
  s.log.push(ev);
  return ev;
}

const clone = (s: TheoState): TheoState => ({
  ...s,
  vitals: { ...s.vitals },
  orders: s.orders.map((o) => ({ ...o, fields: { ...o.fields } })),
  log: [...s.log],
  revealedObjective: [...s.revealedObjective],
  triggered: [...s.triggered],
  reasoning: s.reasoning.map((r) => ({ ...r, diferenciais: [...r.diferenciais] })),
});

// ---------------------------------------------------------------- fisiologia

const oxygenActiveAt = (s: TheoState, sec: number) =>
  s.orders.some(
    (o) =>
      o.kind === "oxigenio" &&
      o.status === "concluida" &&
      o.effectSec !== undefined &&
      o.effectSec <= sec,
  );

const drugEffectiveAt = (s: TheoState, drug: Drug, sec: number) =>
  s.orders.some(
    (o) =>
      o.drug === drug &&
      o.status === "concluida" &&
      o.effectSec !== undefined &&
      o.effectSec <= sec,
  );

function latencies(o: Order) {
  if (o.kind === "oxigenio")
    return {
      prep: theoLatency.oxygenPrep,
      exec: theoLatency.oxygenExec,
      onset: theoLatency.oxygenOnset,
    };
  if (o.drug === "prednisolona")
    return { prep: theoLatency.oralPrep, exec: theoLatency.oralExec, onset: 0 };
  if (o.drug)
    return {
      prep: theoLatency.inhaledPrep,
      exec: theoLatency.inhaledExec,
      onset: theoLatency.inhaledOnset,
    };
  if (o.kind === "exame")
    return { prep: theoLatency.genericPrep, exec: theoLatency.genericExec, onset: 0 };
  return { prep: theoLatency.genericPrep, exec: theoLatency.genericExec, onset: 0 };
}

/** Avança o relógio clínico segundo a segundo, aplicando ordens, efeitos e eventos independentes. */
export function advanceTo(state: TheoState, targetSec: number): TheoState {
  if (targetSec <= state.clockSec) return state;
  // Congelamento absoluto: depois da transferência nem o relógio anda. Deixar
  // `clockSec` avançar fazia o encontro encerrado seguir contando tempo clínico.
  if (state.frozen) return state;
  const s = clone(state);

  for (let sec = s.clockSec + 1; sec <= targetSec; sec++) {
    s.clockSec = sec;

    // 1) transições de ordens (ordem de criação)
    for (const o of s.orders) {
      const { prep, exec, onset } = latencies(o);
      if (
        o.status === "preparo" &&
        o.confirmedAtSec !== undefined &&
        sec >= o.confirmedAtSec + prep
      ) {
        o.status = "execucao";
        o.execStartSec = sec;
        push(s, {
          type: "execucao",
          label: `Execução iniciada — ${o.label}`,
          orderId: o.id,
          detail: describeFields(o),
        });
      } else if (
        o.status === "execucao" &&
        o.execStartSec !== undefined &&
        sec >= o.execStartSec + exec
      ) {
        o.status = "concluida";
        o.doneSec = sec;
        o.effectSec = sec + onset;
        if (o.kind === "exame") {
          o.resultSec = sec + theoLatency.testTurnaround;
          o.resultFactIds = testFactsFor(o.fields.test ?? o.raw).map((f) => f.id);
        }
        push(s, { type: "execucao", label: `Concluído — ${o.label}`, orderId: o.id });
        if (o.drug === "prednisolona") {
          push(s, {
            type: "efeito",
            label: "Corticoide administrado — sem melhora clínica aguda",
            detail:
              "Efeito anti-inflamatório esperado apenas em horas; não altera o quadro imediato.",
            orderId: o.id,
          });
        }
      }

      // 2) efeitos fisiológicos
      if (o.status === "concluida" && o.effectSec !== undefined && sec >= o.effectSec) {
        const t = sec - o.effectSec;
        if (o.kind === "oxigenio") {
          if (t === 0) {
            s.vitals.oximeterSignal = "bom";
            push(s, {
              type: "efeito",
              label: "Oxigênio em uso — sinal do oxímetro estabilizado",
              orderId: o.id,
              tone: "normal",
            });
          }
          if (t > 0 && t % 10 === 0 && s.vitals.spo2 < 96) {
            s.vitals.spo2 = Math.min(96, s.vitals.spo2 + 1);
            if (s.vitals.spo2 === 96 || s.vitals.spo2 === 94)
              push(s, {
                type: "efeito",
                label: `SpO₂ em ${s.vitals.spo2}% com oxigênio`,
                orderId: o.id,
                tone: "normal",
              });
            if (s.vitals.spo2 >= 94 && s.vitals.speech === "palavras")
              s.vitals.speech = "frases_curtas";
          }
        }
        if (o.drug === "salbutamol" || o.drug === "ipratropio") {
          const adjuvant = o.drug === "ipratropio";
          const onsetMark = adjuvant ? 90 : 60;
          if (t === onsetMark) {
            s.vitals.effort = better(EFFORT, s.vitals.effort);
            s.vitals.airEntry = better(AIR, s.vitals.airEntry);
            s.vitals.wheeze =
              s.vitals.wheeze === "silencio" ? "intensa" : better(WHEEZE, s.vitals.wheeze);
            if (!adjuvant) s.vitals.hr = s.vitals.hr + 12;
            push(s, {
              type: "efeito",
              label: adjuvant
                ? "Efeito adjuvante do ipratrópio"
                : "Efeito do broncodilatador inalatório",
              detail: `${EFFORT_LABEL[s.vitals.effort]}, ${AIR_LABEL[s.vitals.airEntry]}, ${WHEEZE_LABEL[s.vitals.wheeze]}${adjuvant ? "" : `, FC ${s.vitals.hr}`}`,
              orderId: o.id,
              tone: "normal",
            });
          }
          if (!adjuvant && t === 120) {
            s.vitals.effort = better(EFFORT, s.vitals.effort);
            s.vitals.airEntry = better(AIR, s.vitals.airEntry);
            s.vitals.wheeze = better(WHEEZE, s.vitals.wheeze);
            s.vitals.speech = better(SPEECH, s.vitals.speech);
            s.vitals.rr = Math.max(24, s.vitals.rr - 6);
            push(s, {
              type: "efeito",
              label: "Resposta sustentada ao broncodilatador",
              detail: `${EFFORT_LABEL[s.vitals.effort]}, ${AIR_LABEL[s.vitals.airEntry]}, ${SPEECH_LABEL[s.vitals.speech]}`,
              orderId: o.id,
              tone: "normal",
            });
          }
        }
      }

      // resultado de exame complementar
      if (o.kind === "exame" && o.resultSec !== undefined && sec === o.resultSec) {
        for (const id of o.resultFactIds ?? []) {
          if (!s.revealedObjective.includes(id)) s.revealedObjective.push(id);
          const f = theoObjectiveFacts.find((x) => x.id === id);
          if (f)
            push(s, {
              type: "observacao",
              label: `Resultado — ${f.label}`,
              detail: f.content,
              orderId: o.id,
            });
        }
      }
    }

    // 3) eventos independentes
    if (
      sec === theoTimeline.hypoxemiaAt &&
      !oxygenActiveAt(s, sec) &&
      !s.triggered.includes("hipoxemia")
    ) {
      s.triggered.push("hipoxemia");
      s.vitals.spo2 = Math.min(s.vitals.spo2, 89);
      s.vitals.speech = worse(SPEECH, "frases_curtas");
      s.vitals.rr = Math.max(s.vitals.rr, 44);
      push(s, {
        type: "evento_independente",
        label: "Deterioração — hipoxemia",
        detail: "SpO₂ 89% em ar ambiente; a criança passa a falar apenas palavras isoladas.",
        tone: "crit",
      });
    }
    if (
      sec === theoTimeline.criticalEffortAt &&
      !drugEffectiveAt(s, "salbutamol", sec) &&
      !s.triggered.includes("esforco")
    ) {
      s.triggered.push("esforco");
      s.vitals.effort = "critico";
      s.vitals.airEntry = "criticamente_reduzida";
      s.vitals.wheeze = "silencio";
      push(s, {
        type: "evento_independente",
        label: "Deterioração — esforço crítico",
        detail:
          "Esforço respiratório crítico com entrada de ar criticamente reduzida e silêncio auscultatório.",
        tone: "crit",
      });
    }
    if (
      sec === theoTimeline.safetyEscalationAt &&
      !s.triggered.includes("seguranca") &&
      (s.vitals.spo2 < 92 || s.vitals.effort === "grave" || s.vitals.effort === "critico")
    ) {
      s.triggered.push("seguranca");
      s.safetyEscalation = true;
      push(s, {
        type: "evento_independente",
        label: "Escalonamento de segurança acionado",
        detail:
          "Paciente permanece instável após 14 minutos: a equipe assistencial aciona o pediatra plantonista e assume o cuidado.",
        tone: "crit",
      });
    }
  }

  s.clockSec = targetSec;
  return s;
}

// -------------------------------------------------------- interpretação livre

export type IntentKind =
  | "conversa"
  | "exame"
  | "monitor"
  | "reavaliar"
  | "aguardar"
  | "ordem"
  | "transferir"
  | "desconhecido";

export type Intent = {
  kind: IntentKind;
  orderKind?: OrderKind | undefined;
  drug?: Drug | undefined;
  seconds?: number | undefined;
  raw: string;
  fields: OrderFields;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function parseFields(raw: string): OrderFields {
  const t = norm(raw);
  const f: OrderFields = {};
  const dose = t.match(/(\d+[.,]?\d*)\s*(gotas?|jatos?|puffs?|doses?|mg|ml|mcg|microgramas?)/);
  if (dose) f.dose = `${dose[1]} ${dose[2]}`;
  const flow = t.match(/(\d+[.,]?\d*)\s*(l\/min|litros?\/min|litros?|lpm|l por minuto)/);
  if (flow) f.flow = `${flow[1]} L/min`;
  const fio2 = t.match(/(\d+)\s*%/);
  if (fio2 && !f.flow) f.flow = `FiO₂ ${fio2[1]}%`;
  if (/cateter|catete|otica|óptica|nasal/.test(t)) f.device = "cateter nasal";
  if (/mascara com reservatorio|nao reinalante|reservatorio/.test(t))
    f.device = "máscara com reservatório";
  else if (/mascara|venturi/.test(t)) f.device = f.device ?? "máscara facial";
  if (/espacador|espaçador|aerocamara|aerocâmara|spacer/.test(t)) f.device = "espaçador";
  if (/nebuliza|inalacao|inalação|nebulis/.test(t)) f.device = "nebulização";
  if (/\b(vo|via oral|oral|boca)\b/.test(t)) f.via = "via oral";
  if (/\b(ev|iv|endovenos|intravenos)/.test(t)) f.via = "endovenosa";
  if (/inalat|nebuliza|espacador|espaçador|bombinha|puff|jato/.test(t))
    f.via = f.via ?? "inalatória";
  const target = t.match(/(alvo|manter|ate|até)\s*(spo2|saturacao|sat)?\s*(?:de\s*)?(\d{2})\s*%/);
  if (target) f.target = `alvo SpO₂ ≥ ${target[3]}%`;
  return f;
}

const TEST_MAP: { re: RegExp; key: string }[] = [
  // Sem o token solto "torax": ele fazia "auscultar o tórax" — exame FÍSICO —
  // ser reconhecido como pedido de radiografia. A solicitação explícita é
  // reconhecida por "raio", "radiograf" ou "rx".
  { re: /raio|radiograf|\brx\b/, key: "radiografia" },
  { re: /gasometr|gaso/, key: "gasometria" },
  { re: /hemograma|sangue|laborat/, key: "hemograma" },
];

/** Chave de exame reconhecida no texto da solicitação, se houver. */
export function chaveDoExame(fields: OrderFields, raw: string): string | null {
  if (fields.test) return fields.test;
  return TEST_MAP.find((m) => m.re.test(norm(raw)))?.key ?? null;
}

/**
 * Este exame é decisivo NESTE CASO e por isso exige raciocínio declarado antes?
 * A resposta vem da configuração do caso — o motor não decide isso sozinho.
 */
export function exigeRaciocinioAntes(
  fields: OrderFields,
  raw: string,
  gating: { examesDecisivos: string[] } = theoGating,
): boolean {
  const chave = chaveDoExame(fields, raw);
  if (!chave) return false;
  return gating.examesDecisivos.includes(chave);
}

function testFactsFor(raw: string): ObjectiveFact[] {
  const t = norm(raw);
  const keys = TEST_MAP.filter((m) => m.re.test(t)).map((m) => m.key);
  const ids: Record<string, string> = {
    radiografia: "o-rx",
    gasometria: "o-gaso",
    hemograma: "o-hemograma",
  };
  return keys.flatMap((k) => {
    const f = theoObjectiveFacts.find((x) => x.id === ids[k]);
    return f ? [f] : [];
  });
}

/** Interpretador determinístico de linguagem livre → intenção estruturada. */
export function parseIntent(raw: string): Intent {
  const t = norm(raw).trim();
  const fields = parseFields(raw);
  const mk = (kind: IntentKind, extra: Partial<Intent> = {}): Intent => ({
    kind,
    raw,
    fields,
    ...extra,
  });

  if (!t) return mk("desconhecido");
  if (
    /transferir|transferencia|passar o caso|passagem de caso|encaminhar|acionar pediatra|chamar pediatra|entregar o cuidado/.test(
      t,
    )
  )
    return mk("transferir");
  const actionVerb =
    /ofert|administr|inici|coloc|instal|prescrev|aplicar|\bdar\b|\bfazer\b|\busar\b|puff|jato|gotas|l\/min/.test(
      t,
    );
  if (
    /oximetr|saturacao|spo2|sat do|checar o monitor|ver o monitor|monitor/.test(t) &&
    !/instalar monitor|monitorizacao|monitorizar/.test(t) &&
    !actionVerb
  )
    return mk("monitor");
  if (/monitorizar|instalar monitor|monitorizacao|colocar monitor/.test(t))
    return mk("ordem", { orderKind: "monitorizacao" });
  if (/acesso venoso|puncionar|pegar acesso|abocath|cateter venoso/.test(t))
    return mk("ordem", { orderKind: "acesso" });
  if (/aguardar|esperar|avancar|passar.*(minuto|tempo)|deixar passar/.test(t)) {
    const m = t.match(/(\d+)\s*(minuto|min|segundo|seg)/);
    const n = m ? Number(m[1]) : 2;
    const secs = m && /seg/.test(m[2]!) ? n : n * 60;
    return mk("aguardar", { seconds: Math.max(10, Math.min(600, secs)) });
  }
  if (/reavaliar|reavalia|nova avaliacao|checar de novo|como esta agora|reexaminar/.test(t))
    return mk("reavaliar");
  if (/oxigenio|oxigênio|o2|hood|catete|mascara/.test(t) && !/exame|solicit/.test(t))
    return mk("ordem", { orderKind: "oxigenio" });
  if (/salbutamol|berotec|fenoterol|bombinha|broncodilatador|beta-?2|b2/.test(t))
    return mk("ordem", { orderKind: "medicamento", drug: "salbutamol" });
  if (/ipratropio|ipratrópio|atrovent|brometo/.test(t))
    return mk("ordem", { orderKind: "medicamento", drug: "ipratropio" });
  if (/prednisolona|prednisona|corticoide|corticosteroide|dexametasona/.test(t))
    return mk("ordem", { orderKind: "medicamento", drug: "prednisolona" });
  if (/solicit|pedir|exame|radiograf|raio|gasometr|hemograma/.test(t)) {
    const test = TEST_MAP.find((m) => m.re.test(t));
    return mk("ordem", {
      orderKind: "exame",
      fields: { ...fields, test: test ? test.key : undefined },
    });
  }
  if (
    /examinar|exame fisico|auscult|palpar|inspecionar|olhar|avaliar|verificar|ver o|checar/.test(t)
  )
    return mk("exame");
  if (/sentar|posicionar|colo da mae|posicao|acalmar|tranquilizar/.test(t))
    return mk("ordem", { orderKind: "posicionamento" });
  return mk("desconhecido");
}

/** Campos clinicamente pertinentes por intervenção — nada irrelevante é exigido. */
export function missingFields(kind: OrderKind, drug: Drug | undefined, f: OrderFields): string[] {
  const missing: string[] = [];
  if (kind === "oxigenio") {
    if (!f.device)
      missing.push("dispositivo (cateter nasal, máscara facial, máscara com reservatório)");
    if (!f.flow) missing.push("fluxo em L/min ou concentração (FiO₂)");
    return missing;
  }
  if (kind === "medicamento") {
    if (!f.dose) missing.push("dose");
    if (drug === "prednisolona") {
      if (!f.via) missing.push("via de administração");
    } else if (!f.device) {
      missing.push("apresentação/dispositivo (espaçador ou nebulização)");
    }
    return missing;
  }
  if (kind === "exame" && !f.test) missing.push("qual exame deseja solicitar");
  return missing;
}

function describeFields(o: Order) {
  const f = o.fields;
  return (
    [f.dose, f.via, f.device, f.flow, f.target, f.test].filter(Boolean).join(" · ") || undefined
  );
}

export function orderLabel(kind: OrderKind, drug?: Drug, fields?: OrderFields) {
  if (kind === "oxigenio") return "Oxigenoterapia";
  if (kind === "medicamento")
    return drug === "salbutamol"
      ? "Salbutamol inalatório"
      : drug === "ipratropio"
        ? "Brometo de ipratrópio"
        : "Prednisolona";
  if (kind === "exame") return `Exame complementar (${fields?.test ?? "a definir"})`;
  if (kind === "monitorizacao") return "Monitorização contínua";
  if (kind === "acesso") return "Acesso venoso periférico";
  return "Posicionamento e acolhimento";
}

// -------------------------------------------------------------------- ações

/**
 * Passagem de caso: exigência mínima para encerrar o encontro.
 *
 * O motor não julga a QUALIDADE clínica do texto — isso é leitura do preceptor,
 * como todo o resto do raciocínio livre. Ele exige apenas que destino e
 * passagem existam e estejam preenchidos, para que "transferi o cuidado" deixe
 * de ser um clique. Comprimento nunca é qualidade.
 */
/**
 * Gate de PREENCHIMENTO, não medida de qualidade. Serve só para impedir campo
 * vazio ou uma palavra; não demonstra passagem estruturada e não é usado como
 * evidência de qualidade em lugar nenhum. A qualidade da passagem é leitura do
 * preceptor — ver `naoAvaliavel` no debrief.
 */
export const PASSAGEM_GATE_CARACTERES = 40;
export const PASSAGEM_GATE_PALAVRAS = 8;

export function avaliarTransferencia(destino: string, passagem: string): string[] {
  const faltas: string[] = [];
  if (!destino.trim()) faltas.push("destino ou profissional responsável");
  const p = passagem.trim();
  const palavras = p ? p.split(/\s+/).length : 0;
  if (p.length < PASSAGEM_GATE_CARACTERES || palavras < PASSAGEM_GATE_PALAVRAS)
    faltas.push(
      `passagem de caso preenchida (mínimo ${PASSAGEM_GATE_CARACTERES} caracteres e ${PASSAGEM_GATE_PALAVRAS} palavras; há ${p.length} e ${palavras})`,
    );
  return faltas;
}

export type TheoAction =
  | {
      type: "fala";
      atSec: number;
      actor: "theo" | "mae" | "equipe";
      question: string;
      reply: string;
      grounded: boolean;
    }
  | { type: "exame"; atSec: number; raw: string }
  | { type: "monitor"; atSec: number }
  | { type: "reavaliar"; atSec: number }
  | { type: "aguardar"; atSec: number; seconds: number }
  | { type: "ordem"; atSec: number; raw: string; intent?: Intent }
  | { type: "esclarecer"; atSec: number; orderId: string; raw: string }
  | { type: "confirmar"; atSec: number; orderId: string }
  | { type: "cancelar"; atSec: number; orderId: string }
  | { type: "transferir"; atSec: number; destino: string; passagem: string }
  | {
      type: "raciocinio";
      atSec: number;
      representacao: string;
      diferenciais: string[];
      confianca: Confianca;
    };

export function monitorSnapshot(v: Vitals) {
  return `SpO₂ ${v.spo2}% (sinal ${v.oximeterSignal}) · FC ${v.hr} · FR ${v.rr} · ${SPEECH_LABEL[v.speech]} · ${EFFORT_LABEL[v.effort]}`;
}

export function clinicalSnapshot(v: Vitals) {
  return `${EFFORT_LABEL[v.effort]}, ${AIR_LABEL[v.airEntry]}, ${WHEEZE_LABEL[v.wheeze]}, ${SPEECH_LABEL[v.speech]}`;
}

/** Aplica uma ação: primeiro o motor avança o tempo, depois a ação é executada. */
export function applyAction(state: TheoState, action: TheoAction): TheoState {
  const advanced = advanceTo(state, Math.max(state.clockSec, action.atSec));
  if (advanced.frozen) return advanced;
  const s = clone(advanced);

  switch (action.type) {
    case "fala": {
      push(s, {
        type: "comunicacao",
        label: `Pergunta a ${action.actor === "theo" ? "Théo" : action.actor === "mae" ? "mãe" : "equipe"}`,
        detail: action.question,
        actor: action.actor,
      });
      push(s, {
        type: "comunicacao",
        label: `Resposta — ${action.actor === "theo" ? "Théo" : action.actor === "mae" ? "mãe" : "equipe"}`,
        detail: action.reply,
        actor: action.actor,
        tone: action.grounded ? "normal" : "warn",
      });
      return s;
    }
    case "exame": {
      const t = norm(action.raw);
      const matched = theoObjectiveFacts.filter(
        (f) => f.source === "exame_fisico" && f.keywords.some((k) => t.includes(norm(k))),
      );
      const found =
        matched.length > 0 ? matched : theoObjectiveFacts.filter((f) => f.id === "o-geral");
      const decision = push(s, { type: "decisao", label: "Exame físico", detail: action.raw });
      for (const f of found) {
        if (!s.revealedObjective.includes(f.id)) s.revealedObjective.push(f.id);
        push(s, {
          type: "observacao",
          label: f.label,
          detail: contextualFinding(f, s.vitals),
          causeId: decision.id,
        });
      }
      return advanceTo(s, s.clockSec + theoLatency.examDuration);
    }
    case "monitor": {
      const d = push(s, { type: "decisao", label: "Verificação do monitor" });
      push(s, {
        type: "observacao",
        label: "Monitor",
        detail: monitorSnapshot(s.vitals),
        causeId: d.id,
      });
      return s;
    }
    case "reavaliar": {
      const d = push(s, { type: "decisao", label: "Reavaliação clínica" });
      push(s, {
        type: "observacao",
        label: "Reavaliação",
        detail: `${monitorSnapshot(s.vitals)} · ${clinicalSnapshot(s.vitals)}`,
        causeId: d.id,
      });
      return advanceTo(s, s.clockSec + theoLatency.examDuration);
    }
    case "aguardar": {
      push(s, {
        type: "decisao",
        label: `Aguardar ${Math.round(action.seconds / 60)} min de observação`,
      });
      return advanceTo(s, s.clockSec + action.seconds);
    }
    case "ordem": {
      const intent = action.intent ?? parseIntent(action.raw);
      if (intent.kind !== "ordem" || !intent.orderKind) {
        push(s, {
          type: "esclarecimento",
          label: "Equipe não compreendeu a solicitação",
          detail:
            "Descreva a ação clínica desejada (por exemplo, ofertar oxigênio, administrar medicação, solicitar exame).",
          tone: "warn",
        });
        return s;
      }
      const fields = { ...intent.fields, ...parseFields(action.raw) };
      // Compromisso antes do dado: só para os exames que ESTE CASO declara
      // decisivos (ver `theoGating` em case-theo.ts).
      if (
        intent.orderKind === "exame" &&
        s.reasoning.length === 0 &&
        exigeRaciocinioAntes(fields, action.raw)
      ) {
        push(s, {
          type: "esclarecimento",
          label: "Exame decisivo bloqueado — raciocínio não declarado",
          detail:
            "Este exame é decisivo neste caso: registre representação do problema, diagnósticos diferenciais e grau de confiança antes de solicitá-lo. Nada foi solicitado.",
          tone: "warn",
        });
        return s;
      }
      const missing = missingFields(intent.orderKind, intent.drug, fields);
      const order: Order = {
        id: `o${s.orders.length + 1}`,
        kind: intent.orderKind,
        drug: intent.drug,
        raw: action.raw,
        label: orderLabel(intent.orderKind, intent.drug, fields),
        fields,
        missing,
        status: missing.length > 0 ? "aguardando_esclarecimento" : "aguardando_confirmacao",
        createdAtSec: s.clockSec,
      };
      s.orders.push(order);
      const d = push(s, {
        type: "decisao",
        label: `Proposta — ${order.label}`,
        detail: action.raw,
        orderId: order.id,
      });
      if (missing.length > 0) {
        push(s, {
          type: "esclarecimento",
          label: `Equipe pede esclarecimento — ${order.label}`,
          detail: `Faltou: ${missing.join("; ")}. Nada será preparado até a ordem ficar completa.`,
          orderId: order.id,
          causeId: d.id,
          tone: "warn",
        });
      }
      return s;
    }
    case "esclarecer": {
      const o = s.orders.find((x) => x.id === action.orderId);
      if (!o || o.status !== "aguardando_esclarecimento") return s;
      o.raw = `${o.raw} | ${action.raw}`;
      o.fields = { ...o.fields, ...parseFields(action.raw) };
      if (o.kind === "exame" && !o.fields.test) {
        const test = TEST_MAP.find((m) => m.re.test(norm(action.raw)));
        if (test) o.fields.test = test.key;
      }
      o.label = orderLabel(o.kind, o.drug, o.fields);
      o.missing = missingFields(o.kind, o.drug, o.fields);
      o.status = o.missing.length > 0 ? "aguardando_esclarecimento" : "aguardando_confirmacao";
      push(s, {
        type: "esclarecimento",
        label: `Esclarecimento — ${o.label}`,
        detail:
          o.missing.length > 0
            ? `Ainda falta: ${o.missing.join("; ")}.`
            : `Ordem completa: ${describeFields(o) ?? "—"}. Aguardando confirmação.`,
        orderId: o.id,
        tone: o.missing.length > 0 ? "warn" : "normal",
      });
      return s;
    }
    case "confirmar": {
      const o = s.orders.find((x) => x.id === action.orderId);
      if (!o || o.status !== "aguardando_confirmacao") return s;
      o.status = "preparo";
      o.confirmedAtSec = s.clockSec;
      push(s, {
        type: "confirmacao",
        label: `Confirmado — ${o.label}`,
        detail: describeFields(o),
        orderId: o.id,
      });
      return s;
    }
    case "cancelar": {
      const o = s.orders.find((x) => x.id === action.orderId);
      if (!o || o.status === "concluida") return s;
      o.status = "cancelada";
      push(s, { type: "decisao", label: `Cancelado — ${o.label}`, orderId: o.id, tone: "warn" });
      return s;
    }
    case "raciocinio": {
      const faltas = avaliarRaciocinio(action.representacao, action.diferenciais, action.confianca);
      if (faltas.length > 0) {
        push(s, {
          type: "esclarecimento",
          label: "Raciocínio não registrado",
          detail: `Faltou: ${faltas.join("; ")}.`,
          tone: "warn",
        });
        return s;
      }
      const entrada: ReasoningEntry = {
        atSec: s.clockSec,
        representacao: action.representacao.trim(),
        diferenciais: action.diferenciais.map((x) => x.trim()).filter(Boolean),
        confianca: action.confianca,
      };
      s.reasoning.push(entrada);
      push(s, {
        type: "raciocinio",
        label: `Raciocínio declarado — ${CONFIANCA_LABEL[entrada.confianca]}`,
        detail: `Representação: ${entrada.representacao} | Diferenciais: ${entrada.diferenciais.join("; ")}`,
      });
      return s;
    }
    case "transferir": {
      const faltas = avaliarTransferencia(action.destino, action.passagem);
      if (faltas.length > 0) {
        push(s, {
          type: "esclarecimento",
          label: "Transferência não concluída — passagem de caso insuficiente",
          detail: `Faltou: ${faltas.join("; ")}. O encontro segue aberto e sob sua responsabilidade.`,
          tone: "warn",
        });
        return s;
      }
      const destino = action.destino.trim();
      const passagem = action.passagem.trim();
      s.transfer = { destino, passagem, atSec: s.clockSec };
      s.frozen = true;
      push(s, {
        type: "transferencia",
        label: `Cuidado transferido — ${destino}`,
        detail: `Destino: ${destino}. Passagem de caso: ${passagem}`,
        tone: "warn",
      });
      return s;
    }
  }
}

function contextualFinding(f: ObjectiveFact, v: Vitals) {
  if (f.id === "o-ausculta")
    return `${WHEEZE_LABEL[v.wheeze]}, ${AIR_LABEL[v.airEntry]}, tempo expiratório prolongado`;
  if (f.id === "o-esforco") return `${EFFORT_LABEL[v.effort]}: ${f.content}`;
  if (f.id === "o-geral") return `${f.content}; ${SPEECH_LABEL[v.speech]}`;
  return f.content;
}

// ------------------------------------------------------------------ debrief

export type DebriefStatus = "demonstrado" | "parcialmente" | "nao_observado" | "nao_avaliavel";

export type DebriefItem = {
  id: string;
  titulo: string;
  status: DebriefStatus;
  evidencias: string[];
  consequencia?: string | undefined;
};

export type Debrief = {
  automatico: true;
  itens: DebriefItem[];
  cronologia: CausalEvent[];
  encerramento: string;
  naoAvaliavel: string[];
};

export const DEBRIEF_LABEL: Record<DebriefStatus, string> = {
  demonstrado: "Demonstrado",
  parcialmente: "Parcialmente",
  nao_observado: "Não observado",
  nao_avaliavel: "Não avaliável automaticamente",
};

const ev = (s: TheoState, pred: (e: CausalEvent) => boolean) => s.log.filter(pred);

/** Debrief 100% derivado do log: sem nota, sem LLM, sem julgar raciocínio livre. */
export function buildDebrief(state: TheoState): Debrief {
  const itens: DebriefItem[] = [];
  const fmt = (e: CausalEvent) =>
    `${clockLabel(e.atSec)} — ${e.label}${e.detail ? `: ${e.detail}` : ""}`;

  const falasTheo = ev(state, (e) => e.type === "comunicacao" && e.actor === "theo");
  const falasMae = ev(state, (e) => e.type === "comunicacao" && e.actor === "mae");
  itens.push({
    id: "comunicacao-crianca",
    titulo: "Comunicação com a criança",
    status:
      falasTheo.length >= 4
        ? "demonstrado"
        : falasTheo.length > 0
          ? "parcialmente"
          : "nao_observado",
    evidencias: falasTheo.slice(0, 4).map(fmt),
  });
  itens.push({
    id: "comunicacao-acompanhante",
    titulo: "Coleta de história com o acompanhante",
    status:
      falasMae.length >= 4 ? "demonstrado" : falasMae.length > 0 ? "parcialmente" : "nao_observado",
    evidencias: falasMae.slice(0, 4).map(fmt),
  });

  const exames = ev(state, (e) => e.type === "decisao" && e.label === "Exame físico");
  const monitor = ev(state, (e) => e.type === "decisao" && e.label === "Verificação do monitor");
  itens.push({
    id: "avaliacao-inicial",
    titulo: "Avaliação clínica objetiva (exame físico e monitor)",
    status:
      exames.length > 0 && monitor.length > 0
        ? "demonstrado"
        : exames.length + monitor.length > 0
          ? "parcialmente"
          : "nao_observado",
    evidencias: [...exames, ...monitor].slice(0, 5).map(fmt),
  });

  const o2 = state.orders.find((o) => o.kind === "oxigenio" && o.status === "concluida");
  const hipoxemia = state.log.find((e) => e.label === "Deterioração — hipoxemia");
  itens.push({
    id: "oxigenio",
    titulo: "Oferta de oxigênio diante da hipoxemia",
    status: o2 ? (hipoxemia ? "parcialmente" : "demonstrado") : "nao_observado",
    evidencias: o2
      ? [
          `${clockLabel(o2.doneSec ?? o2.createdAtSec)} — ${o2.label} (${describeFields(o2) ?? "—"})`,
        ]
      : [],
    consequencia: hipoxemia
      ? `Sem oxigênio efetivo até ${clockLabel(hipoxemia.atSec)}, a SpO₂ caiu para 89% e a fala reduziu a palavras isoladas.`
      : o2
        ? "A oferta precoce de oxigênio manteve a saturação e evitou o evento de hipoxemia."
        : "Nenhum oxigênio efetivo foi ofertado durante o encontro.",
  });

  const broncho = state.orders.find((o) => o.drug === "salbutamol" && o.status === "concluida");
  const esforco = state.log.find((e) => e.label === "Deterioração — esforço crítico");
  itens.push({
    id: "broncodilatador",
    titulo: "Broncodilatador inalatório em tempo hábil",
    status: broncho ? (esforco ? "parcialmente" : "demonstrado") : "nao_observado",
    evidencias: broncho
      ? [
          `${clockLabel(broncho.doneSec ?? broncho.createdAtSec)} — ${broncho.label} (${describeFields(broncho) ?? "—"})`,
        ]
      : [],
    consequencia: esforco
      ? `Sem broncodilatador efetivo até ${clockLabel(esforco.atSec)}, o esforço tornou-se crítico com silêncio auscultatório.`
      : broncho
        ? "O broncodilatador reduziu o esforço, melhorou a entrada de ar e a sibilância."
        : "Nenhum broncodilatador foi administrado.",
  });

  const esclarecimentos = ev(state, (e) => e.type === "esclarecimento" && e.tone === "warn");
  itens.push({
    id: "completude",
    titulo: "Completude da prescrição (dose, via, dispositivo, alvo)",
    status:
      state.orders.length === 0
        ? "nao_observado"
        : esclarecimentos.length === 0
          ? "demonstrado"
          : "parcialmente",
    evidencias: esclarecimentos.slice(0, 4).map(fmt),
    consequencia:
      esclarecimentos.length > 0
        ? "A equipe precisou pedir esclarecimento antes de preparar a intervenção; nada foi executado até a ordem ficar completa."
        : undefined,
  });

  const reaval = ev(state, (e) => e.type === "decisao" && e.label === "Reavaliação clínica");
  const primeiraIntervencao = state.orders.find((o) => o.doneSec !== undefined)?.doneSec;
  const reavalDepois = reaval.filter(
    (e) => primeiraIntervencao !== undefined && e.atSec > primeiraIntervencao,
  );
  itens.push({
    id: "reavaliacao",
    titulo: "Reavaliação após intervenção",
    status:
      primeiraIntervencao === undefined
        ? "nao_avaliavel"
        : reavalDepois.length > 0
          ? "demonstrado"
          : "nao_observado",
    evidencias: reavalDepois.slice(0, 3).map(fmt),
    consequencia:
      primeiraIntervencao === undefined
        ? "Não houve intervenção concluída para reavaliar."
        : undefined,
  });

  const primeiroExameDecisivo = state.orders.find(
    (o) => o.kind === "exame" && exigeRaciocinioAntes(o.fields, o.raw),
  );
  const raciocinios = state.reasoning;
  const raciocinioAntesDoExame =
    raciocinios.length > 0 &&
    (primeiroExameDecisivo === undefined ||
      raciocinios[0]!.atSec <= primeiroExameDecisivo.createdAtSec);
  itens.push({
    id: "raciocinio-declarado",
    titulo: "Raciocínio declarado (representação do problema, diferenciais, confiança)",
    // Registra que foi expresso e quando. A qualidade semântica do conteúdo
    // não é julgada aqui — ver `naoAvaliavel`.
    status:
      raciocinios.length === 0
        ? "nao_observado"
        : raciocinioAntesDoExame
          ? "demonstrado"
          : "parcialmente",
    evidencias: raciocinios
      .slice(0, 3)
      .map(
        (r) =>
          `${clockLabel(r.atSec)} — ${CONFIANCA_LABEL[r.confianca]} · representação: ${r.representacao} · diferenciais: ${r.diferenciais.join("; ")}`,
      ),
    consequencia:
      raciocinios.length === 0
        ? theoGating.examesDecisivos.length > 0
          ? "Nenhum exame decisivo deste caso pôde ser solicitado, porque exige raciocínio declarado antes."
          : "Este caso não declara exame decisivo, então nada foi bloqueado; o raciocínio simplesmente não foi declarado."
        : undefined,
  });

  itens.push({
    id: "seguranca",
    titulo: "Estabilização antes do limite de segurança",
    status: state.safetyEscalation
      ? "nao_observado"
      : state.clockSec >= theoTimeline.safetyEscalationAt
        ? "demonstrado"
        : "nao_avaliavel",
    evidencias: state.log.filter((e) => e.label === "Escalonamento de segurança acionado").map(fmt),
    consequencia: state.safetyEscalation
      ? "A instabilidade persistiu até 14 minutos e a equipe teve de acionar o escalonamento de segurança."
      : state.clockSec < theoTimeline.safetyEscalationAt
        ? "O encontro terminou antes do marco de 14 minutos; não é possível afirmar o desfecho de segurança."
        : undefined,
  });

  const transferenciasRecusadas = ev(
    state,
    (e) => e.label === "Transferência não concluída — passagem de caso insuficiente",
  );
  itens.push({
    id: "transferencia",
    titulo: "Destino e passagem registrados",
    // Afirma apenas o que é verificável: os dois campos foram preenchidos. Se a
    // passagem é estruturada e suficiente NÃO é avaliado — ver `naoAvaliavel`.
    status: state.transfer ? "demonstrado" : "nao_observado",
    evidencias: state.transfer
      ? [
          `${clockLabel(state.transfer.atSec)} — destino: ${state.transfer.destino}`,
          `${clockLabel(state.transfer.atSec)} — passagem: ${state.transfer.passagem}`,
        ]
      : transferenciasRecusadas.slice(0, 2).map(fmt),
    consequencia:
      transferenciasRecusadas.length > 0
        ? `Houve ${transferenciasRecusadas.length} tentativa(s) de encerrar sem preencher a passagem de caso; o encontro seguiu aberto até o registro.`
        : undefined,
  });

  return {
    automatico: true,
    itens,
    cronologia: state.log,
    encerramento: state.transfer
      ? `Encontro encerrado por transferência do cuidado para ${state.transfer.destino} às ${clockLabel(state.transfer.atSec)}.`
      : state.safetyEscalation
        ? "Encontro encerrado por evento de segurança."
        : "Encontro ainda em curso.",
    naoAvaliavel: [
      "Raciocínio clínico expresso em texto livre não é validado automaticamente — requer leitura do preceptor.",
      "A representação do problema, os diferenciais e o grau de confiança são registrados como expressos e datados; se estão corretos, pertinentes ou calibrados NÃO é avaliado automaticamente.",
      "A qualidade da passagem de caso NÃO é avaliada automaticamente: o debrief afirma apenas que destino e passagem foram registrados. Se a passagem é estruturada, completa e segura é leitura do preceptor.",
      "A qualidade do vínculo com a criança e a mãe é registrada como ocorrência, não como acerto ou erro.",
    ],
  };
}
