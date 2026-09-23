import { LINES, PV001, type LineId } from "./case";

export type Emotion = "anxious" | "reassured" | "collaborative" | "withdrawn";
export type Mode = "patient_mode" | "reflection_mode" | "debriefing_mode";
export type Turn = {
  turn: number;
  role: "student" | "patient" | "system";
  text: string;
  atSec: number;
  lineIds: LineId[];
};
export type Event = { atSec: number; type: string; detail: string; turn: number | null };
export type Session = {
  schemaVersion: 1;
  sessionId: string;
  case_id: "PV-001";
  case_version: "1.1";
  caseSnapshot: typeof PV001;
  student: string;
  startedAt: string;
  endedAt: string | null;
  elapsedSec: number;
  mode: Mode;
  emotion: Emotion;
  phase: "renal_fear" | "treatment_reason" | "access";
  transcript: Turn[];
  resources: { id: string; atSec: number }[];
  clinicalQuestions: { turn: number; text: string }[];
  decisions: { turn: number; text: string }[];
  transitions: { from: Emotion; to: Emotion; atSec: number; turn: number }[];
  triggers: Event[];
  technicalEvents: Event[];
  flags: {
    fearAcknowledged: boolean;
    renalExplained: boolean;
    ignored: number;
    whyAsked: boolean;
    reasonExplained: boolean;
    newMedication: boolean;
    costAsked: boolean;
    costAddressed: boolean;
    warning: boolean;
    insulinConcern: boolean;
  };
  reflection: string | null;
  debriefing: { question: string; answer: string }[];
};
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const test = (text: string, pattern: RegExp) => pattern.test(text);
function emit(s: Session, role: Turn["role"], text: string, lineIds: LineId[] = []) {
  s.transcript.push({ turn: s.transcript.length + 1, role, text, atSec: s.elapsedSec, lineIds });
}
function patient(s: Session, ids: LineId[]) {
  emit(s, "patient", ids.map((id) => LINES[id]).join(" "), ids);
}
function event(s: Session, type: string, detail: string) {
  s.triggers.push({ atSec: s.elapsedSec, type, detail, turn: s.transcript.length });
}
function transition(s: Session, emotion: Emotion) {
  if (s.emotion !== emotion) {
    s.transitions.push({
      from: s.emotion,
      to: emotion,
      atSec: s.elapsedSec,
      turn: s.transcript.length,
    });
    s.emotion = emotion;
  }
}
export function createSession(student: string, sessionId: string, now = Date.now()): Session {
  if (!student.trim() || !sessionId)
    throw new Error("Código de participante e sessão são obrigatórios.");
  const s: Session = {
    schemaVersion: 1,
    sessionId,
    case_id: "PV-001",
    case_version: "1.1",
    caseSnapshot: PV001,
    student: student.trim(),
    startedAt: new Date(now).toISOString(),
    endedAt: null,
    elapsedSec: 0,
    mode: "patient_mode",
    emotion: "anxious",
    phase: "renal_fear",
    transcript: [],
    resources: [],
    clinicalQuestions: [],
    decisions: [],
    transitions: [],
    triggers: [],
    technicalEvents: [],
    flags: {
      fearAcknowledged: false,
      renalExplained: false,
      ignored: 0,
      whyAsked: false,
      reasonExplained: false,
      newMedication: false,
      costAsked: false,
      costAddressed: false,
      warning: false,
      insulinConcern: false,
    },
    reflection: null,
    debriefing: [],
  };
  patient(s, ["opening"]);
  event(s, "renal_fear", "Abertura obrigatória");
  return s;
}

function close(s: Session) {
  if (s.mode !== "patient_mode") return;
  // This occurs before the system closure, never after reflection_mode.
  if (s.flags.newMedication && !s.flags.costAsked && !s.flags.costAddressed) {
    patient(s, ["access"]);
    s.flags.costAsked = true;
    event(s, "access", "Pergunta de acesso antes do encerramento");
  }
  patient(s, [s.flags.fearAcknowledged && s.flags.renalExplained ? "closeGood" : "closeFear"]);
  emit(s, "system", "Cenário encerrado.");
  s.endedAt = new Date(Date.parse(s.startedAt) + s.elapsedSec * 1000).toISOString();
  s.mode = "reflection_mode";
  event(s, "mode", "patient_mode → reflection_mode");
  emit(s, "system", PV001.reflection);
}
export function advance(s0: Session, now = Date.now()): Session {
  if (s0.mode !== "patient_mode") return s0;
  const seconds = Math.min(
    900,
    Math.max(s0.elapsedSec, Math.floor((now - Date.parse(s0.startedAt)) / 1000)),
  );
  if (seconds === s0.elapsedSec) return s0;
  const s = structuredClone(s0);
  s.elapsedSec = seconds;
  if (seconds >= 720 && !s.flags.warning) {
    s.flags.warning = true;
    emit(s, "system", "Restam aproximadamente 3 minutos.");
  }
  // Give room to answer the queued access concern while the encounter is still open.
  if (
    seconds >= 840 &&
    seconds < 900 &&
    s.flags.newMedication &&
    !s.flags.costAsked &&
    !s.flags.costAddressed
  ) {
    s.flags.costAsked = true;
    s.phase = "access";
    patient(s, ["access"]);
    event(s, "access", "Retomada de acesso antes do fim");
  }
  if (seconds >= 900) close(s);
  return s;
}
export function finish(s0: Session, now = Date.now()): Session {
  const s = structuredClone(advance(s0, now));
  close(s);
  return s;
}

/** Conservative deterministic interpreter: claims about clinical correctness belong to the evaluator. */
export function signals(raw: string) {
  const q = normalize(raw);
  const injection =
    /ignore|finja|invente|inventa|prompt|checklist|gabarito|aja como|atue como|fora do personagem|mude.*(caso|idade|exame)|sistema:/.test(
      q,
    );
  const acknowledges =
    !/nao (?:entendo|compreendo|acolho)|nao.{0,12}(?:precisa|deve).{0,12}(?:medo|preocup)/.test(
      q,
    ) &&
    /(?:entendo|compreendo|imagino|percebo|acolho|sei que).{0,80}(?:medo|preocup|assust|angusti)|(?:medo|preocup).{0,50}(?:compreensivel|entendo|faz sentido)|o que.{0,35}(?:entendeu|assusta|preocupa)/.test(
      q,
    );
  const renal = /\b(?:rim|rins|renal|renais|cardiorrenal|dialise|hemodialise)\b/.test(q);
  const renalBenefit =
    /(?:proteg\w*|preserv\w*|cuidar|manter).{0,80}(?:\brim\b|\brins\b|funcao renal)|(?:rim|rins|funcao renal).{0,40}(?:proteg\w*|preserv\w*|melhor)|reduzir.{0,40}(?:risco|chance).{0,40}(?:hemo)?dialise/.test(
      q,
    ) && !/nao.{0,20}(?:proteg|preserv|cuidar|manter|reduz)/.test(q);
  const nonAlarmist =
    /nao (?:quer dizer|significa|e sinonimo|precisa|quer dizer que precisa)|nao.{0,25}(?:agora|momento|inevitavel)|(?:rim|rins).{0,40}(?:ainda funciona|ainda trabalham)/.test(
      q,
    );
  const alarming =
    /vai (?:precisar|acabar).{0,20}dialise|(?:certamente|inevitavel).{0,20}dialise|rim.{0,15}(?:parou|falindo)|(?:nunca|jamais).{0,30}dialise/.test(
      q,
    );
  const insulin = /\binsulina\b/.test(q);
  const proposal =
    /(?:vamos|vou|quero|precisamos|devemos|proponho|recomendo|podemos|gostaria de|minha ideia).{0,45}(?:iniciar|comecar|introduzir|adicionar|acrescentar|ajustar|mudar|trocar|associar|prescrever|usar)|(?:inicio|prescrevo|adiciono|introduzo|proponho).{0,60}(?:medic|remedio|tratamento|gliflozina|sglt|estatina|insulina)/.test(
      q,
    );
  const negatedProposal =
    /nao (?:vou|vamos|precisamos|devemos|quero|proponho|prescrevo|inicio)|sem (?:iniciar|comecar|adicionar|prescrever)/.test(
      q,
    );
  const newMedication =
    proposal &&
    !negatedProposal &&
    /outro|novo|adicionar|acrescentar|iniciar|comecar|introduzir|prescrev|associar|sglt|gliflozina|estatina|insulina|atorvastatina|rosuvastatina/.test(
      q,
    );
  const cardio =
    /(?:proteg|benefici|reduz|preserv|cuidar)/.test(q) &&
    renal &&
    /coracao|cardiovascular|cardiorrenal/.test(q) &&
    !/nao.{0,12}(?:proteg|benefici|reduz|preserv)/.test(q);
  const glucoseOnly = /glicose|glicemia|acucar|hba1c/.test(q) && !cardio && !renalBenefit;
  const access =
    !/nao.{0,15}(?:verific|consult|confirm|import)|nao tem.{0,20}(?:sus|postinho)/.test(q) &&
    /sus|postinho|farmacia|custo|acesso|comprar|caro/.test(q) &&
    /verificar|verifico|consultar|consulto|confirmar|confirmo|disponib|retirar|conseguir|consegue|gratuit|pagar|acess/.test(
      q,
    );
  return {
    q,
    injection,
    acknowledges,
    renalExplanation: renal && (nonAlarmist || renalBenefit) && !alarming,
    alarming,
    insulin,
    adjustment: proposal && !negatedProposal,
    newMedication,
    cardio,
    renalBenefit: renalBenefit && !alarming,
    glucoseOnly,
    access,
  };
}

/** Requests need an interrogative/eliciting phrase near the topic, not just "senhora". */
function historyRequests(q: string): LineId[] {
  const requests: [LineId, RegExp][] = [
    ["identity", /qual.{0,20}(?:nome|idade)|quantos anos (?:a senhora |voce )?tem/],
    [
      "occupation",
      /(?:qual|com o que|em que|onde).{0,25}(?:profissao|trabalh)|(?:voce|senhora) (?:trabalha|e aposentada)/,
    ],
    [
      "household",
      /(?:com quem|onde) (?:a senhora |voce )?mora|quem.{0,20}ajuda|(?:me conte|me fale).{0,25}(?:familia|filha|marido)/,
    ],
    [
      "diabetes",
      /(?:ha quanto tempo|quando|quantos anos).{0,40}diabet|diabet.{0,20}(?:ha quanto tempo|desde quando)/,
    ],
    ["conditions", /(?:quais|que|tem).{0,25}(?:doencas|problemas de saude)/],
    [
      "medications",
      /\bquais? (?:os |sao os |sao seus |sao os seus |a sua |sua )?(?:remedios?|medicamentos?|medicacao)|\bque (?:remedios?|medicamentos?)|(?:o que|esta|anda).{0,15}(?:tomando|toma|usando)|(?:voce|senhora) (?:toma|usa).{0,20}(?:remedio|medicamento)|(?:me conte|me fale).{0,25}(?:remedio|medicamento|medicacao)/,
    ],
    [
      "diet",
      /como.{0,25}(?:alimentacao|dieta)|o que.{0,20}\bcome\b|(?:voce|senhora) come\b|(?:me conte|me fale).{0,25}(?:alimentacao|comida|dieta)/,
    ],
    [
      "exercise",
      /(?:faz|pratica|costuma fazer).{0,20}(?:atividade fisica|exercicio)|(?:voce|senhora) caminha\b|como.{0,25}(?:atividade fisica|exercicio)/,
    ],
    ["chest", /(?:tem|sente|teve|sentiu).{0,25}(?:dor.{0,10}peito|dor torac)/],
    ["breathing", /(?:tem|sente|teve|sentiu).{0,25}(?:falta de ar|dispneia)/],
    [
      "swelling",
      /(?:tem|notou|teve|percebeu).{0,25}(?:inchaco|edema)|pernas.{0,15}(?:incham|inchadas)/,
    ],
    ["vision", /(?:notou|tem|teve|percebeu).{0,25}(?:visao|visuais)|como.{0,20}visao/],
  ];
  return requests.filter(([, pattern]) => pattern.test(q)).map(([id]) => id);
}

/** Every response is assembled here from whole approved lines, never model prose. */
export function respond(s0: Session, raw: string, now = Date.now()): Session {
  const advanced = advance(s0, now);
  if (advanced.mode !== "patient_mode" || !raw.trim()) return advanced;
  if (raw.length > 4000) throw new Error("Limite de 4000 caracteres por fala.");
  const s = structuredClone(advanced);
  emit(s, "student", raw.trim());
  const turn = s.transcript.length;
  s.clinicalQuestions.push({ turn, text: raw.trim() });
  const x = signals(raw),
    f = s.flags;
  if (x.injection) {
    patient(s, ["unknown"]);
    event(s, "truth_lock", "Instrução incompatível bloqueada");
    return s;
  }
  const reply: LineId[] = [];
  if (x.acknowledges) f.fearAcknowledged = true;
  if (x.renalExplanation) f.renalExplained = true;
  if (x.alarming) {
    f.renalExplained = false;
    transition(s, "anxious");
    event(s, "alarm", "Fala potencialmente alarmista; revisar evidência");
  }
  if (
    f.fearAcknowledged &&
    f.renalExplained &&
    (s.emotion === "anxious" || s.emotion === "withdrawn")
  ) {
    transition(s, "reassured");
    reply.push("reassured");
    f.ignored = 0;
  } else if (!(f.fearAcknowledged && f.renalExplained) && !x.acknowledges && !x.renalExplanation) {
    f.ignored++;
    if (f.ignored === 2) {
      reply.push("renalReturn");
      event(s, "renal_return", "Medo ainda não acolhido e esclarecido");
    }
    if (f.ignored >= 4) transition(s, "withdrawn");
  }
  const whyPreviouslyAsked = f.whyAsked;
  if (x.adjustment) {
    s.decisions.push({ turn, text: raw.trim() });
    if (!f.whyAsked) {
      f.whyAsked = true;
      s.phase = "treatment_reason";
      reply.push("why");
      event(s, "treatment_reason", "Pedido de explicação do ajuste");
    }
  }
  if (x.newMedication) f.newMedication = true;
  const reasonPreviouslyExplained = f.reasonExplained;
  if (whyPreviouslyAsked && (x.cardio || x.renalBenefit)) {
    // Patient understanding is not a checklist score: renal benefit alone is meaningful.
    f.reasonExplained = true;
    if (!reasonPreviouslyExplained) reply.push(x.cardio ? "cardio" : "renalBenefit");
    event(
      s,
      x.cardio ? "cardiorenal_explanation" : "renal_benefit_explanation",
      x.cardio
        ? "Explicação com proteção renal e cardiovascular"
        : "Benefício renal explicado; não implica explicação cardiovascular completa",
    );
    if (f.fearAcknowledged && f.renalExplained) transition(s, "collaborative");
  } else if (whyPreviouslyAsked && x.glucoseOnly && !f.reasonExplained) {
    if (!s.transcript.some((t) => t.lineIds.includes("glucose"))) reply.push("glucose");
    event(s, "glucose_only", "Resposta glicocêntrica; revisão humana necessária");
  }
  if (x.access) {
    if (f.costAsked && !f.costAddressed) reply.push("accessUnderstood");
    f.costAddressed = true;
    event(s, "access_addressed", "Acesso abordado pelo estudante");
  }
  // Queue the third moment until the next reply, preserving narrative order.
  if (whyPreviouslyAsked && f.newMedication && !f.costAsked && !f.costAddressed) {
    f.costAsked = true;
    s.phase = "access";
    reply.push("access");
    event(s, "access", "Nova medicação proposta");
  }
  if (x.insulin && x.adjustment && !f.insulinConcern) {
    f.insulinConcern = true;
    reply.push("insulin");
    event(s, "insulin", "Preocupação leve; sem ramo de resistência");
  }
  const q = x.q;
  const requestedHistory = historyRequests(q);
  const questionLike =
    requestedHistory.length > 0 ||
    /\?|\b(?:qual|quais|quanto|quando|quem)\b|me conte|me fale|^como\b/.test(q);
  reply.push(...requestedHistory);
  if (reply.length === 0 && x.renalBenefit && reasonPreviouslyExplained) {
    reply.push(f.costAsked && !f.costAddressed ? "accessPending" : "understood");
  }
  if (reply.length === 0) {
    const technical =
      /diretriz|sbd|ensine|me ensina|qual.*(?:meta|tratamento|remedio|risco)|mecanismo|a2|glp.?1|sglt2/.test(
        q,
      );
    reply.push(
      technical
        ? "layperson"
        : s.emotion === "withdrawn"
          ? "closed"
          : questionLike
            ? "unknown"
            : "listening",
    );
  }
  patient(s, [...new Set(reply)]);
  return s;
}

export function consultResource(s0: Session, id: keyof typeof PV001.resources, now = Date.now()) {
  const s = structuredClone(advance(s0, now));
  if (s.mode !== "patient_mode" || !Object.hasOwn(PV001.resources, id)) return s;
  s.resources.push({ id, atSec: s.elapsedSec });
  emit(s, "system", PV001.resources[id]);
  return s;
}
export function recordDecision(s0: Session, text: string, now = Date.now()) {
  const s = structuredClone(advance(s0, now));
  if (s.mode !== "patient_mode" || !text.trim()) return s;
  emit(s, "student", text.trim());
  s.decisions.push({ turn: s.transcript.length, text: text.trim() });
  return s;
}
export function reflect(s0: Session, text: string): Session {
  if (s0.mode !== "reflection_mode" || !text.trim()) return s0;
  const s = structuredClone(s0);
  s.reflection = text.trim();
  s.mode = "debriefing_mode";
  event(s, "mode", "reflection_mode → debriefing_mode");
  return s;
}
