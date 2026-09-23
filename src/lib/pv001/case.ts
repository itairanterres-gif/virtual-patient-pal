/** PV-001 v1.1. Instructor-authored truth; never merge student/model data into it. */
function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const PV001 = freeze({
  id: "PV-001",
  version: "1.1",
  engineVersion: "1.1.0",
  durationSec: 900,
  title: "Maria Aparecida Souza — DM2, alto risco cardiovascular e doença renal do diabetes",
  publicTitle: "Maria Aparecida Souza — consulta de retorno",
  audience: "Internos da 12ª fase",
  complexity: "baixa",
  environment: "Consulta ambulatorial do SUS",
  objective:
    "Ao final da simulação, o interno deverá priorizar e comunicar um plano terapêutico cardiorrenal individualizado e factível no SUS para uma pessoa com DM2 e doença renal do diabetes, considerando seu risco cardiovascular, suas preferências e suas barreiras de acesso ao tratamento.",
  briefing:
    "Você é o médico responsável pela consulta de retorno de uma paciente com DM2 na atenção ambulatorial do SUS. Foram realizados exames recentemente. Conduza a consulta e estabeleça o plano de cuidado.",
  prebriefing: [
    "Esta é uma simulação com uma paciente fictícia.",
    "Este é um ambiente de aprendizagem sem julgamento, com revisão humana formativa.",
    "Preserve a confidencialidade do desempenho fora do grupo. Use um código de participante, sem nome completo.",
    "Você pode solicitar informações e exames adicionais durante a cena; dados não previstos serão sinalizados como indisponíveis.",
  ],
  truth: {
    name: "Maria Aparecida Souza",
    age: 61,
    sex: "F",
    occupation: "Aposentada, ex-auxiliar de serviços gerais",
    household: "Mora com o marido; filha próxima auxilia nas idas à unidade de saúde",
    dm2Years: 8,
    diagnoses: ["DM2", "Hipertensão arterial", "Dislipidemia"],
    knownASCVD: false,
    medications: ["Metformina 1000 mg 12/12h", "Losartana 50 mg 12/12h"],
    current: {
      hba1c: 8.2,
      creatinine: 1.25,
      egfr: 49,
      acr: 45,
      totalCholesterol: 240,
      ldl: 162,
      bp: "148/92",
    },
    previous: { monthsAgo: 4, egfr: 49, acr: 52 },
    // Habits retained from v1.0, optional, never checklist requirements.
    habits: { sedentary: true, dietaryAdherence: "irregular" },
    deniedSymptoms: [
      "dor torácica",
      "dispneia",
      "edema de membros inferiores",
      "alterações visuais",
    ],
  },
  resources: {
    exames:
      "Exames atuais: HbA1c 8,2%; creatinina 1,25 mg/dL; TFGe 49 mL/min/1,73m²; RAC 45 mg/g; colesterol total 240 mg/dL; LDL-c 162 mg/dL. Exames de 4 meses atrás: TFGe 49 mL/min/1,73m²; RAC 52 mg/g.",
    pressao: "PA: 148/92 mmHg.",
    medicamentos: "Metformina 1000 mg 12/12h; losartana 50 mg 12/12h.",
  },
  reflection:
    "Como você avalia sua condução da consulta? O que faria diferente se pudesse repeti-la?",
  debrief: [
    "Como foi para você essa consulta?",
    "Em que momento ficou mais difícil?",
    "O que nos exames fez você mudar a prioridade terapêutica?",
    "Se tivesse olhado apenas a HbA1c, o que teria feito de diferente?",
    "O que mudou na consulta quando a paciente falou do rim?",
    "E quando falou do custo do remédio?",
    "Qual princípio desta consulta você leva para o próximo paciente com diabetes que atender na UBS?",
    "Se esta fosse sua paciente na atenção primária, o que você organizaria para o seguimento dela?",
  ],
});

// Complete approved patient vocabulary. No clinical free text can be emitted.
export const LINES = freeze({
  opening: "Falaram que meu rim não está bom. Vou acabar fazendo diálise?",
  renalReturn: "Mas eu ainda estou preocupada com esse negócio do rim.",
  closed: "Eu ainda estou preocupada...",
  reassured: "Fico mais tranquila com essa explicação.",
  why: "Mas eu já tomo remédio para diabetes. Por que outro?",
  cardio: "Ah, então não é só pelo açúcar.",
  glucose: "Entendi o que falou do açúcar, mas ainda não entendi o que isso tem a ver com meu rim.",
  access: "Esse remédio tem no postinho? Eu não consigo ficar comprando remédio caro.",
  accessUnderstood: "Assim fica mais fácil para mim. Podemos combinar como vai ser?",
  insulin: "Insulina? Ai, não sei...",
  identity: "Sou Maria Aparecida Souza, tenho 61 anos.",
  occupation: "Sou aposentada. Trabalhei como auxiliar de serviços gerais.",
  household: "Moro com meu marido. Minha filha mora perto e me ajuda a ir à unidade de saúde.",
  diabetes: "Tenho diabetes há oito anos.",
  conditions: "Tenho diabetes, pressão alta e colesterol alto.",
  medications:
    "Tomo metformina de mil, de doze em doze horas, e losartana de cinquenta, de doze em doze horas.",
  diet: "Eu tento, mas em casa é difícil, o marido gosta de comida mais gordurosa e eu acabo comendo igual.",
  exercise:
    "Não faço atividade física. Já ouvi isso tanto que nem presto mais atenção, me desculpe dizer.",
  chest: "Não tenho dor no peito.",
  breathing: "Não sinto falta de ar.",
  swelling: "Não tenho inchaço nas pernas.",
  vision: "Não notei alterações na visão.",
  unknown: "Isso eu não sei dizer.",
  remember: "Não lembro.",
  layperson: "Não entendo esses termos. Pode me explicar?",
  listening: "Estou ouvindo.",
  understood: "Pode me explicar como vai ser?",
  closeGood: "Agora entendi melhor, obrigada por explicar.",
  closeFear: "Só uma coisa... eu ainda estou com medo desse negócio de diálise.",
});
export type LineId = keyof typeof LINES;
