import type { VitalStatus } from "./cases";

/** Estados possíveis de cada fato clínico no information ledger. */
export type FactState =
  | "hidden"
  | "revealed"
  | "withheld_sensitive"
  | "unknown_to_patient"
  | "unavailable";

export type FactCategory =
  | "demografia"
  | "historia"
  | "antecedentes"
  | "medicamentos"
  | "alergias"
  | "habitos"
  | "exame_fisico"
  | "exame_complementar"
  | "fisiologia"
  | "complicacao";

export type ClinicalFact = {
  id: string;
  category: FactCategory;
  label: string;
  content: string;
  /** O paciente conhece e pode verbalizar este fato? */
  patientKnows: boolean;
  initialState: FactState;
  status?: VitalStatus;
};

export type PhysicalExamAction = {
  id: string;
  label: string;
  group: string;
  /** palavras-chave para reconhecer a manobra descrita em texto livre */
  keywords: string[];
  reveals: string[];
  durationSec: number;
};

export type TestOrder = {
  id: string;
  label: string;
  category: "eletro" | "laboratorio" | "imagem" | "beira-leito";
  reveals: string[];
  /** segundos até o resultado ficar disponível (0 = imediato) */
  turnaroundSec: number;
};

export type ManagementAction = {
  id: string;
  label: string;
  category:
    | "medicamento"
    | "oxigenio"
    | "monitorizacao"
    | "acesso"
    | "fluidos"
    | "procedimento"
    | "interconsulta"
    | "transferencia";
  appropriate: boolean;
  note: string;
};

export type CaseStage = "initial" | "evaluated" | "investigated" | "treated" | "outcome";

export type EventKind =
  | "pergunta"
  | "resposta"
  | "exame_fisico"
  | "exame_solicitado"
  | "resultado"
  | "hipotese"
  | "conduta"
  | "estado";

export type ClinicalEvent = {
  id: string;
  atSec: number;
  clock: string;
  kind: EventKind;
  label: string;
  detail?: string;
  refId?: string;
  status: VitalStatus;
};

export type EvaluationDomain =
  | "rapport"
  | "anamnese"
  | "raciocinio"
  | "diagnostico"
  | "conduta"
  | "seguranca";

export type RubricCriterion = {
  id: string;
  domain: EvaluationDomain;
  label: string;
  weight: number;
  /** critério observável: derivado somente do event log da sessão */
  check: (ctx: RubricContext) => boolean;
};

export type RubricContext = {
  events: ClinicalEvent[];
  studentQuestions: string[];
};

export type EngineCase = {
  id: string;
  patientTruth: {
    demographics: string;
    chiefComplaint: string;
    persona: string;
    facts: ClinicalFact[];
    diagnosis: string;
    differentials: string[];
    physiology: string;
    complications: string[];
  };
  physicalExams: PhysicalExamAction[];
  tests: TestOrder[];
  managements: ManagementAction[];
  rubric: RubricCriterion[];
};

export const DOMAIN_LABELS: Record<EvaluationDomain, string> = {
  rapport: "Rapport",
  anamnese: "Anamnese",
  raciocinio: "Raciocínio clínico",
  diagnostico: "Diagnóstico",
  conduta: "Conduta",
  seguranca: "Segurança clínica / priorização",
};

export function clock(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

export function makeEvent(
  kind: EventKind,
  label: string,
  atSec: number,
  extra: Partial<ClinicalEvent> = {},
): ClinicalEvent {
  return {
    id: `${kind}-${atSec}-${Math.random().toString(36).slice(2, 8)}`,
    atSec,
    clock: clock(atSec),
    kind,
    label,
    status: "normal",
    ...extra,
  };
}

/** Progressão de estado do caso derivada do event log. */
export function stageFromEvents(events: ClinicalEvent[], finished: boolean): CaseStage {
  if (finished) return "outcome";
  if (events.some((e) => e.kind === "conduta")) return "treated";
  if (events.some((e) => e.kind === "resultado")) return "investigated";
  if (events.some((e) => e.kind === "exame_fisico")) return "evaluated";
  return "initial";
}

export const STAGE_LABELS: Record<CaseStage, string> = {
  initial: "Avaliação inicial",
  evaluated: "Paciente examinada",
  investigated: "Investigação em curso",
  treated: "Tratamento iniciado",
  outcome: "Desfecho / encerrado",
};

/** Ledger: estado atual de cada fato a partir dos eventos de revelação. */
export function buildLedger(
  engineCase: EngineCase,
  revealedFactIds: string[],
): Record<string, FactState> {
  const ledger: Record<string, FactState> = {};
  for (const fact of engineCase.patientTruth.facts) {
    ledger[fact.id] = revealedFactIds.includes(fact.id) ? "revealed" : fact.initialState;
  }
  return ledger;
}

export type CriterionResult = { criterion: RubricCriterion; met: boolean };
export type DomainScore = {
  domain: EvaluationDomain;
  label: string;
  score: number;
  met: CriterionResult[];
  missed: CriterionResult[];
};

/** Pontuação determinística: derivada apenas dos eventos, nunca do LLM. */
export function scoreSession(engineCase: EngineCase, ctx: RubricContext): DomainScore[] {
  const domains = Object.keys(DOMAIN_LABELS) as EvaluationDomain[];
  return domains.map((domain) => {
    const criteria = engineCase.rubric.filter((c) => c.domain === domain);
    const results: CriterionResult[] = criteria.map((criterion) => ({
      criterion,
      met: safeCheck(criterion, ctx),
    }));
    const total = criteria.reduce((sum, c) => sum + c.weight, 0);
    const earned = results.reduce((sum, r) => sum + (r.met ? r.criterion.weight : 0), 0);
    return {
      domain,
      label: DOMAIN_LABELS[domain],
      score: total === 0 ? 0 : Math.round((earned / total) * 100),
      met: results.filter((r) => r.met),
      missed: results.filter((r) => !r.met),
    };
  });
}

function safeCheck(criterion: RubricCriterion, ctx: RubricContext) {
  try {
    return criterion.check(ctx);
  } catch {
    return false;
  }
}

/* Helpers de predicado usados pelas rubricas dos casos. */
export function asked(ctx: RubricContext, ...terms: string[]) {
  const text = ctx.studentQuestions.join(" \n ").toLowerCase();
  return terms.some((t) => text.includes(t.toLowerCase()));
}

export function didEvent(ctx: RubricContext, kind: EventKind, refId: string) {
  return ctx.events.some((e) => e.kind === kind && e.refId === refId);
}

export function eventAtSec(ctx: RubricContext, kind: EventKind, refId: string) {
  return ctx.events.find((e) => e.kind === kind && e.refId === refId)?.atSec;
}
