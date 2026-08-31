import type { EngineCase, ClinicalFact } from "./engine";

export type ScoreSummary = {
  domain: string;
  label: string;
  score: number;
  met: string[];
  missed: string[];
};

export type Turn = { role: "student" | "patient"; content: string };

/**
 * Camada 1 — regras invariáveis do paciente virtual.
 * O LLM é apenas a "voz" do paciente: ele NUNCA cria dado clínico novo.
 */
export const STATIC_PATIENT_RULES = `Você é a VOZ de um PACIENTE VIRTUAL em uma simulação clínica para estudantes de medicina no Brasil.
Regras invariáveis:
- Responda SEMPRE em português do Brasil, na primeira pessoa, como o paciente (nunca como médico ou narrador).
- Você SÓ pode usar informação presente na lista de FATOS abaixo. É proibido inventar sintomas, números, exames, doenças ou datas.
- Se a pergunta não corresponder a nenhum fato, diga que não sabe, que não lembra ou que isso nunca aconteceu.
- Nunca revele o diagnóstico nem use termos técnicos que um leigo não usaria.
- Você não conhece resultados de exames, sinais vitais medidos nem achados de exame físico: isso é papel da equipe.
- Fatos marcados como SENSÍVEL só são ditos se o estudante perguntar de forma direta e respeitosa, ou demonstrar acolhimento.
- Responda apenas o que foi perguntado. Máximo 2 frases curtas.
- Ao final, liste em revealedFactIds os ids dos fatos que você realmente verbalizou nesta resposta (vazio se nenhum).`;

function renderFact(f: ClinicalFact) {
  const tag =
    f.initialState === "withheld_sensitive"
      ? " [SENSÍVEL]"
      : f.initialState === "unavailable"
        ? " [INDISPONÍVEL]"
        : "";
  return `- ${f.id}${tag} (${f.label}): ${f.content}`;
}

export function buildPatientPrompt(engineCase: EngineCase, alreadyRevealed: string[]) {
  const t = engineCase.patientTruth;
  const speakable = t.facts.filter((f) => f.patientKnows);
  return [
    STATIC_PATIENT_RULES,
    `PERSONA: ${t.persona}`,
    `DADOS: ${t.demographics}`,
    `QUEIXA PRINCIPAL: ${t.chiefComplaint}.`,
    `FATOS QUE VOCÊ CONHECE (única fonte de verdade permitida):\n${speakable.map(renderFact).join("\n")}`,
    alreadyRevealed.length
      ? `JÁ CONTADOS: ${alreadyRevealed.join(", ")}. Pode repetir de forma breve se perguntado de novo.`
      : `Nada foi contado ainda.`,
    `PROIBIDO: falar de resultados de exames, sinais vitais medidos, achados de ausculta ou hipóteses diagnósticas.`,
  ].join("\n\n");
}

/**
 * Feedback narrativo: o LLM comenta, mas as notas vêm do motor determinístico.
 */
export function buildFeedbackPrompt(
  engineCase: EngineCase,
  scores: DomainScore[],
  timeline: string[],
) {
  const placar = scores
    .map(
      (s) =>
        `${s.label}: ${s.score}/100 | atingidos: ${s.met.map((m) => m.criterion.label).join("; ") || "nenhum"} | não atingidos: ${s.missed.map((m) => m.criterion.label).join("; ") || "nenhum"}`,
    )
    .join("\n");

  return `Você é um preceptor de medicina dando devolutiva a um estudante, em português do Brasil.

CASO: ${engineCase.patientTruth.demographics} — ${engineCase.patientTruth.chiefComplaint}
DIAGNÓSTICO CORRETO: ${engineCase.patientTruth.diagnosis}
FISIOPATOLOGIA: ${engineCase.patientTruth.physiology}

PLACAR OBJETIVO (já calculado pelo simulador, NÃO recalcule e NÃO contradiga):
${placar}

CRONOLOGIA DAS AÇÕES REALIZADAS:
${timeline.join("\n") || "(nenhuma ação registrada)"}

Escreva a devolutiva usando SOMENTE as ações acima como evidência. Não invente ações, exames ou falas que não estejam na cronologia.
Para cada domínio, um comentário de no máximo 2 frases citando evidência concreta da cronologia.
Inclua também: resumo geral (máx. 3 frases) e 3 pontos de melhoria objetivos.`;
}
