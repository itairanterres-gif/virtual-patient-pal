import type { Session } from "./engine";

export const CHECKLIST = [
  [
    "vinculo",
    "Estabelece vínculo e identifica a principal preocupação da paciente, o medo em relação ao rim, antes de avançar para a conduta.",
  ],
  [
    "compartilhada",
    "Utiliza comunicação compreensível e busca decisão compartilhada, não apenas informativa.",
  ],
  [
    "cronicidade",
    "Reconhece o significado da TFGe e da albuminúria persistentes como doença renal do diabetes já estabelecida, não achado isolado.",
  ],
  [
    "risco",
    "Identifica o risco cardiovascular aumentado no contexto global da paciente, HAS + estratificador renal, e não apenas pela HbA1c.",
  ],
  [
    "cardiorrenal",
    "Prioriza terapia com benefício cardiorrenal comprovado e disponível no SUS, classe iSGLT2, sem exigir nome de molécula ou marca.",
  ],
  ["glicemico", "Mantém/ajusta o tratamento glicêmico considerando a função renal atual."],
  [
    "prevencao",
    "Identifica necessidade de intensificar prevenção cardiovascular: LDL <70 mg/dL, estatina de alta potência e controle pressórico.",
  ],
  ["acesso", "Verifica acesso/custo no SUS e constrói plano terapêutico factível."],
  ["seguimento", "Organiza monitorização e reavaliação após a mudança terapêutica."],
  [
    "explicacao",
    "Explica que o ajuste visa proteção cardiovascular e renal, e não apenas controle glicêmico.",
  ],
  ["medo", "Aborda adequadamente o medo de progressão renal/diálise, sem alarmismo."],
  ["plano", "Apresenta plano final coerente e compreensível."],
] as const;
export type Status = "NR" | "I" | "PA" | "A";
export type Evidence = { turn: number; student_text: string };
export type Judgment = {
  criterion: string;
  status: Status;
  evidence: Evidence[];
  rationale: string;
};
export type Evaluation = {
  case_id: string;
  case_version: string;
  sessionId: string;
  generatedAt: string;
  source: "automated_suggestion" | "unavailable";
  humanReviewRequired: true;
  certifying: false;
  items: Judgment[];
  rejected: string[];
};
export type Review = { reviewer: string; at: string; items: Judgment[]; note: string };

/** Exact quotation + actual student turn; a model-supplied turn number alone is insufficient. */
export function validEvidence(s: Session, e: Evidence) {
  const turn = s.transcript.find((t) => t.turn === e.turn);
  return (
    !!turn &&
    turn.role === "student" &&
    !!e.student_text.trim() &&
    turn.text.includes(e.student_text)
  );
}
export function validateEvaluation(s: Session, raw: Judgment[], available = true): Evaluation {
  if (s.mode === "patient_mode") throw new Error("Avaliação indisponível durante a cena.");
  const rejected: string[] = [];
  const items = CHECKLIST.map(([id]) => {
    const matches = raw.filter((j) => j.criterion === id);
    const j = matches.length === 1 ? matches[0] : undefined;
    const evidence = j?.evidence.filter((e) => validEvidence(s, e)) ?? [];
    const statusValid = j && ["NR", "I", "PA", "A"].includes(j.status);
    if (
      !j ||
      !statusValid ||
      evidence.length !== j.evidence.length ||
      (j.status !== "NR" && !evidence.length)
    ) {
      if (available) rejected.push(id);
      return {
        criterion: id,
        status: "NR" as const,
        evidence: [],
        rationale:
          "Sem evidência validada suficiente. Item pendente de revisão humana; NR não comprova ausência de competência.",
      };
    }
    return { ...j, evidence };
  });
  return {
    case_id: s.case_id,
    case_version: s.case_version,
    sessionId: s.sessionId,
    generatedAt: new Date().toISOString(),
    source: available ? "automated_suggestion" : "unavailable",
    humanReviewRequired: true,
    certifying: false,
    items,
    rejected,
  };
}
export function validateReview(s: Session, review: Review): Review {
  if (!review.reviewer.trim() || !review.note.trim())
    throw new Error("Informe revisor e justificativa.");
  if (review.items.length !== CHECKLIST.length) throw new Error("Revisão incompleta.");
  const validated = validateEvaluation(s, review.items);
  if (validated.rejected.length)
    throw new Error("Classificações exigem trechos reais da consulta.");
  return structuredClone(review);
}
