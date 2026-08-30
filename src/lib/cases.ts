export type VitalStatus = "normal" | "warn" | "crit";

export type Vital = {
  label: string;
  value: string;
  unit: string;
  status: VitalStatus;
  pulse?: boolean;
};

export type ExamItem = { name: string; result: string; status: VitalStatus };

export type ClinicalCase = {
  id: string;
  patientName: string;
  age: number;
  sex: "F" | "M";
  weightKg: number;
  bed: string;
  specialty: string;
  difficulty: number;
  chiefComplaint: string;
  environment: string;
  summary: string;
  persona: string;
  hiddenHistory: string;
  vitals: Vital[];
  physicalExam: ExamItem[];
  labs: ExamItem[];
  managements: string[];
  correctDiagnosis: string;
};

export const CASES: ClinicalCase[] = [
  {
    id: "dor-toracica",
    patientName: "Joana M.",
    age: 68,
    sex: "F",
    weightKg: 67,
    bed: "leito 4",
    specialty: "Cardiologia",
    difficulty: 4,
    chiefComplaint: "dor torácica há 40 min",
    environment: "Emergência",
    summary:
      "Mulher de 68 anos, hipertensa, chega ao pronto-socorro com dor retroesternal em aperto e dispneia.",
    persona:
      "Você é Joana, 68 anos, aposentada, ansiosa e falante. Fala em português coloquial do Brasil, frases curtas. Está com dor no peito e assustada.",
    hiddenHistory:
      "Dor retroesternal em aperto iniciada há 40 minutos em repouso, irradia para mandíbula e braço esquerdo, 8/10, associada a sudorese fria, náusea e dispneia. Hipertensa há 20 anos (losartana 50mg), diabética tipo 2 (metformina), ex-tabagista 30 maços-ano, pai faleceu de infarto aos 60. Nega febre, nega trauma. Não usou nada para a dor.",
    vitals: [
      { label: "FC", value: "104", unit: "bpm", status: "normal", pulse: true },
      { label: "PA", value: "158/96", unit: "mmHg", status: "warn" },
      { label: "SpO₂", value: "88", unit: "%", status: "crit", pulse: true },
      { label: "FR", value: "22", unit: "irpm", status: "normal" },
      { label: "Temp", value: "36.4", unit: "°C", status: "normal" },
      { label: "Glasgow", value: "15", unit: "nível", status: "normal" },
    ],
    physicalExam: [
      { name: "Cardiovascular", result: "Ritmo regular, B4 audível, sem sopros", status: "warn" },
      { name: "Respiratório", result: "Estertores em bases, MV diminuído", status: "warn" },
      { name: "Pele", result: "Sudorese fria, palidez", status: "warn" },
      { name: "Neurológico", result: "Lúcida, orientada, sem déficits", status: "normal" },
    ],
    labs: [
      { name: "ECG 12 derivações", result: "Supra de ST em V2–V4", status: "crit" },
      { name: "Troponina T ultrassensível", result: "0,42 ng/mL", status: "crit" },
      { name: "Hemograma", result: "Hb 13,8 g/dL · Leuco 9.400", status: "normal" },
      { name: "Rx de tórax", result: "Congestão pulmonar leve", status: "warn" },
    ],
    managements: [
      "AAS 300 mg VO mastigado",
      "Oxigênio suplementar 3 L/min",
      "Nitrato sublingual",
      "Morfina IV se dor refratária",
      "Acionar hemodinâmica (angioplastia primária)",
    ],
    correctDiagnosis: "Infarto agudo do miocárdio com supradesnivelamento de ST (parede anterior)",
  },
  {
    id: "dispneia-crianca",
    patientName: "Théo R.",
    age: 6,
    sex: "M",
    weightKg: 22,
    bed: "sala de observação",
    specialty: "Pediatria",
    difficulty: 3,
    chiefComplaint: "falta de ar e chiado há 1 dia",
    environment: "Pronto atendimento",
    summary:
      "Menino de 6 anos, atópico, com sibilância e tiragem intercostal após quadro de coriza.",
    persona:
      "Você é Théo, 6 anos, tímido, responde curto e às vezes a mãe completa. Está cansado de tanto tossir.",
    hiddenHistory:
      "Tosse seca e chiado há 24h, piora à noite, precedidos de coriza há 3 dias. Já teve 4 crises semelhantes; usa salbutamol em casa, sem corticoide de manutenção. Rinite alérgica, mãe asmática. Sem febre. Última crise há 4 meses, sem internação.",
    vitals: [
      { label: "FC", value: "132", unit: "bpm", status: "warn", pulse: true },
      { label: "PA", value: "100/62", unit: "mmHg", status: "normal" },
      { label: "SpO₂", value: "92", unit: "%", status: "warn", pulse: true },
      { label: "FR", value: "38", unit: "irpm", status: "crit" },
      { label: "Temp", value: "37.1", unit: "°C", status: "normal" },
      { label: "Peak flow", value: "55", unit: "% pred", status: "warn" },
    ],
    physicalExam: [
      { name: "Respiratório", result: "Sibilos difusos, tempo expiratório prolongado", status: "crit" },
      { name: "Tórax", result: "Tiragem intercostal e subcostal", status: "warn" },
      { name: "Cardiovascular", result: "Taquicárdico, sem sopros", status: "warn" },
      { name: "ORL", result: "Mucosa nasal pálida, secreção clara", status: "normal" },
    ],
    labs: [
      { name: "Gasometria arterial", result: "pH 7,42 · pCO₂ 34 · pO₂ 68", status: "warn" },
      { name: "Rx de tórax", result: "Hiperinsuflação, sem consolidações", status: "normal" },
      { name: "Hemograma", result: "Eosinofilia discreta", status: "normal" },
    ],
    managements: [
      "Salbutamol inalatório com espaçador (3 séries)",
      "Corticoide sistêmico (prednisolona 1 mg/kg)",
      "Oxigênio para SpO₂ ≥ 94%",
      "Brometo de ipratrópio associado",
      "Reavaliar em 1h e definir alta ou internação",
    ],
    correctDiagnosis: "Crise de asma moderada em criança atópica",
  },
  {
    id: "dor-abdominal",
    patientName: "Marcos L.",
    age: 34,
    sex: "M",
    weightKg: 81,
    bed: "leito 9",
    specialty: "Cirurgia geral",
    difficulty: 2,
    chiefComplaint: "dor abdominal há 18 horas",
    environment: "Emergência",
    summary:
      "Homem de 34 anos com dor periumbilical migrando para fossa ilíaca direita, náusea e inapetência.",
    persona:
      "Você é Marcos, 34 anos, motorista de aplicativo, objetivo e um pouco impaciente. Está incomodado com a dor e quer resolver rápido.",
    hiddenHistory:
      "Dor iniciada há 18h na região periumbilical, migrou para fossa ilíaca direita nas últimas 6h, contínua, 7/10, piora ao andar e tossir. Náusea, dois episódios de vômito, anorexia. Última evacuação normal ontem. Sem cirurgias prévias, sem alergias.",
    vitals: [
      { label: "FC", value: "98", unit: "bpm", status: "normal", pulse: true },
      { label: "PA", value: "128/78", unit: "mmHg", status: "normal" },
      { label: "SpO₂", value: "98", unit: "%", status: "normal" },
      { label: "FR", value: "18", unit: "irpm", status: "normal" },
      { label: "Temp", value: "38.1", unit: "°C", status: "warn" },
      { label: "Dor (EVA)", value: "7", unit: "/10", status: "warn" },
    ],
    physicalExam: [
      { name: "Abdome", result: "Blumberg positivo em FID, descompressão dolorosa", status: "crit" },
      { name: "Ruídos hidroaéreos", result: "Diminuídos", status: "warn" },
      { name: "Sinal do psoas", result: "Positivo", status: "warn" },
      { name: "Cardiovascular", result: "Sem alterações", status: "normal" },
    ],
    labs: [
      { name: "Hemograma", result: "Leuco 15.200 com desvio à esquerda", status: "warn" },
      { name: "PCR", result: "78 mg/L", status: "warn" },
      { name: "US de abdome", result: "Apêndice espessado, 9 mm, não compressível", status: "crit" },
      { name: "Urina tipo I", result: "Sem alterações", status: "normal" },
    ],
    managements: [
      "Jejum e hidratação venosa",
      "Analgesia venosa",
      "Antibioticoprofilaxia",
      "Avaliação cirúrgica — apendicectomia",
      "Tomografia se dúvida diagnóstica",
    ],
    correctDiagnosis: "Apendicite aguda não complicada",
  },
];

export function getCase(id: string) {
  return CASES.find((c) => c.id === id);
}
