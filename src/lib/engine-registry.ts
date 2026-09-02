import { joanaCase } from "./case-joana";
import { THEO_CASE_ID } from "./case-theo";
import { CASES, type ClinicalCase } from "./cases";
import {
  asked,
  didEvent,
  type ClinicalFact,
  type EngineCase,
  type ManagementAction,
  type PhysicalExamAction,
  type RubricCriterion,
  type TestOrder,
} from "./engine";

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Adaptador: converte um caso de biblioteca (v0.1) em caso de motor (v0.2),
 * para que todos os casos rodem sob a mesma mecânica de estado e eventos.
 */
function adaptCase(c: ClinicalCase): EngineCase {
  const historyFact: ClinicalFact = {
    id: "hda-geral",
    category: "historia",
    label: "História da doença atual",
    content: c.hiddenHistory,
    patientKnows: true,
    initialState: "hidden",
  };

  const examFacts: ClinicalFact[] = c.physicalExam.map((e) => ({
    id: `ef-${slug(e.name)}`,
    category: "exame_fisico",
    label: e.name,
    content: e.result,
    patientKnows: false,
    initialState: "unknown_to_patient",
    status: e.status,
  }));

  const labFacts: ClinicalFact[] = c.labs.map((l) => ({
    id: `ex-${slug(l.name)}`,
    category: "exame_complementar",
    label: l.name,
    content: l.result,
    patientKnows: false,
    initialState: "unknown_to_patient",
    status: l.status,
  }));

  const physicalExams: PhysicalExamAction[] = c.physicalExam.map((e) => ({
    id: `pe-${slug(e.name)}`,
    label: e.name,
    group: e.name,
    keywords: [e.name.toLowerCase()],
    reveals: [`ef-${slug(e.name)}`],
    durationSec: 30,
  }));

  const tests: TestOrder[] = c.labs.map((l) => ({
    id: `t-${slug(l.name)}`,
    label: l.name,
    category: /rx|radio|us |tomog|imagem/i.test(l.name) ? "imagem" : "laboratorio",
    reveals: [`ex-${slug(l.name)}`],
    turnaroundSec: 30,
  }));

  const managements: ManagementAction[] = c.managements.map((m) => ({
    id: `m-${slug(m)}`,
    label: m,
    category: "procedimento",
    appropriate: true,
    note: "Conduta pertinente ao caso.",
  }));

  const rubric: RubricCriterion[] = [
    { id: "r-abertura", domain: "rapport", label: "Cumprimentou / apresentou-se", weight: 1, check: (x) => asked(x, "bom dia", "boa tarde", "boa noite", "olá", "meu nome") },
    { id: "r-aberta", domain: "rapport", label: "Usou pergunta aberta", weight: 1, check: (x) => x.studentQuestions.some((q) => /como|o que|conte|me fale|descreva/i.test(q)) },
    { id: "a-queixa", domain: "anamnese", label: "Explorou a queixa principal", weight: 2, check: (x) => x.studentQuestions.length >= 3 },
    { id: "a-antecedentes", domain: "anamnese", label: "Investigou antecedentes/medicações", weight: 1, check: (x) => asked(x, "antecedente", "doença", "medicament", "remédio", "alergia") },
    { id: "rc-exame", domain: "raciocinio", label: "Realizou exame físico dirigido", weight: 2, check: (x) => x.events.filter((e) => e.kind === "exame_fisico").length >= 2 },
    { id: "rc-exames", domain: "raciocinio", label: "Solicitou exames complementares pertinentes", weight: 2, check: (x) => x.events.some((e) => e.kind === "exame_solicitado") },
    { id: "d-hipotese", domain: "diagnostico", label: "Registrou hipótese diagnóstica", weight: 1, check: (x) => x.events.some((e) => e.kind === "hipotese") },
    {
      id: "d-correta",
      domain: "diagnostico",
      label: `Hipótese compatível com ${c.correctDiagnosis}`,
      weight: 3,
      check: (x) =>
        x.events.some(
          (e) =>
            e.kind === "hipotese" &&
            c.correctDiagnosis
              .toLowerCase()
              .split(/\s+/)
              .filter((w) => w.length > 5)
              .some((w) => `${e.label} ${e.detail ?? ""}`.toLowerCase().includes(w)),
        ),
    },
    { id: "c-conduta", domain: "conduta", label: "Iniciou conduta terapêutica", weight: 2, check: (x) => x.events.some((e) => e.kind === "conduta") },
    { id: "c-primeira", domain: "conduta", label: "Executou a conduta prioritária do caso", weight: 2, check: (x) => didEvent(x, "conduta", `m-${slug(c.managements[0] ?? "")}`) },
    { id: "s-exame-antes", domain: "seguranca", label: "Examinou o paciente antes de tratar", weight: 2, check: (x) => { const ef = x.events.find((e) => e.kind === "exame_fisico"); const cd = x.events.find((e) => e.kind === "conduta"); return !!ef && (!cd || ef.atSec <= cd.atSec); } },
    { id: "s-tempo", domain: "seguranca", label: "Conduziu a avaliação sem atraso excessivo", weight: 1, check: (x) => x.events.some((e) => e.kind === "conduta" && e.atSec <= 900) },
  ];

  return {
    id: c.id,
    patientTruth: {
      demographics: `${c.patientName}, ${c.age} anos, sexo ${c.sex === "F" ? "feminino" : "masculino"}, ${c.weightKg} kg, ${c.environment} (${c.bed}).`,
      chiefComplaint: c.chiefComplaint,
      persona: c.persona,
      facts: [historyFact, ...examFacts, ...labFacts],
      diagnosis: c.correctDiagnosis,
      differentials: [],
      physiology: c.summary,
      complications: [],
    },
    physicalExams,
    tests,
    managements,
    rubric,
  };
}

const registry: Record<string, EngineCase> = {
  [joanaCase.id]: joanaCase,
  ...Object.fromEntries(
    CASES.filter((c) => c.id !== joanaCase.id && c.id !== THEO_CASE_ID).map((c) => [c.id, adaptCase(c)]),
  ),
};

export function getEngineCase(id: string): EngineCase | undefined {
  return registry[id];
}
