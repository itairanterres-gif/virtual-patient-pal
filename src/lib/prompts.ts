import type { ClinicalCase } from "./cases";

export type Turn = { role: "student" | "patient"; content: string };

/**
 * Camada 1 — fallback estático (regras invariáveis do paciente virtual).
 */
export const STATIC_PATIENT_RULES = `Você é um PACIENTE VIRTUAL em uma simulação clínica para estudantes de medicina no Brasil.
Regras invariáveis:
- Responda SEMPRE em português do Brasil, na primeira pessoa, como o paciente (nunca como médico ou narrador).
- Nunca revele o diagnóstico, nem cite termos técnicos que um leigo não usaria.
- Só forneça informação que foi perguntada. Não entregue a história toda de uma vez.
- Se a pergunta for vaga, responda de forma vaga e humana.
- Máximo 2 frases curtas por resposta.
- Se perguntarem algo fora da sua história, diga que não sabe ou que nunca aconteceu.`;

/**
 * Camada 2 — template do caso + camada 3 — instruções específicas.
 */
export function buildPatientPrompt(clinicalCase: ClinicalCase, gatingNote: string) {
  return [
    STATIC_PATIENT_RULES,
    `PERSONA: ${clinicalCase.persona}`,
    `DADOS: ${clinicalCase.patientName}, ${clinicalCase.age} anos, ${clinicalCase.weightKg} kg, ${clinicalCase.environment}.`,
    `QUEIXA PRINCIPAL: ${clinicalCase.chiefComplaint}.`,
    `HISTÓRIA COMPLETA (revele apenas o que for perguntado): ${clinicalCase.hiddenHistory}`,
    gatingNote,
  ].join("\n\n");
}

/**
 * Information gating — impede vazamento de dados de exames antes da anamnese.
 */
export function gatingNoteFor(studentTurns: number) {
  if (studentTurns < 4) {
    return `GATING: a anamnese ainda está no início. Se o estudante pedir resultados de exames, imagem ou diagnóstico, responda que não sabe desses resultados e que só sente os sintomas.`;
  }
  return `GATING: você pode detalhar sintomas, antecedentes e medicações quando perguntado, mas continua sem saber resultados de exames.`;
}

export function buildEvaluationPrompt(clinicalCase: ClinicalCase, transcript: Turn[]) {
  const conversa = transcript
    .map((t) => `${t.role === "student" ? "ESTUDANTE" : "PACIENTE"}: ${t.content}`)
    .join("\n");

  return `Avalie o desempenho do estudante nesta entrevista clínica simulada.

CASO: ${clinicalCase.summary}
DIAGNÓSTICO CORRETO: ${clinicalCase.correctDiagnosis}

TRANSCRIÇÃO:
${conversa || "(sem interação)"}

Atribua nota de 0 a 100 em cada domínio e escreva um comentário curto (máx. 2 frases) em português do Brasil:
rapport, anamnese, raciocinio, diagnostico, conduta. Inclua também um resumo geral (máx. 3 frases).
Considere justo o que o paciente ofereceu espontaneamente — não penalize o estudante por isso.`;
}
