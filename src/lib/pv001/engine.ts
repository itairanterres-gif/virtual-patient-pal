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
  const renal = /rim|rins|renal|dialise/.test(q);
  const nonAlarmist =
    /nao (?:quer dizer|significa|e sinonimo|precisa|quer dizer que precisa)|nao.{0,25}(?:agora|momento|inevitavel)|(?:proteger|cuidar|preservar|acompanhar).{0,35}(?:rim|rins|funcao renal)|(?:rim|rins).{0,40}(?:ainda funciona|ainda trabalham)/.test(
      q,
    );
  const alarming =
    /vai (?:precisar|acabar).{0,20}dialise|(?:certamente|inevitavel).{0,20}dialise|rim.{0,15}(?:parou|falindo)|(?:nunca|jamais).{0,30}dialise/.test(
      q,
    );
  const insulin = /\binsulina\b/.test(q);
  const proposal =
    /(?:vamos|vou|quero|precisamos|devemos|proponho|recomendo|podemos|gostaria de).{0,45}(?:iniciar|comecar|introduzir|adicionar|acrescentar|ajustar|mudar|trocar|associar|prescrever|usar)|(?:inicio|prescrevo|adiciono|introduzo|proponho).{0,60}(?:medic|remedio|tratamento|gliflozina|sglt|estatina|insulina)/.test(
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
  const glucoseOnly = /glicose|glicemia|acucar|hba1c/.test(q) && !cardio;
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
    renalExplanation: renal && nonAlarmist && !alarming,
    alarming,
    insulin,
    adjustment: proposal && !negatedProposal,
    newMedication,
    cardio,
    glucoseOnly,
    access,
  };
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
  if (whyPreviouslyAsked && x.cardio) {
    f.reasonExplained = true;
    reply.push("cardio");
    event(s, "cardiorenal_explanation", "Explicação com proteção renal e cardiovascular");
    if (f.fearAcknowledged && f.renalExplained) transition(s, "collaborative");
  } else if (whyPreviouslyAsked && x.glucoseOnly && !f.reasonExplained) {
    reply.push("glucose");
    event(s, "glucose_only", "Resposta glicocêntrica; revisão humana necessária");
  }
  if (x.access) {
    f.costAddressed = true;
    if (f.costAsked) reply.push("accessUnderstood");
    event(s, "access_addressed", "Acesso abordado pelo estudante");
  }
  // Queue the third moment until the next reply, preserving narrative order.
  if (whyPreviouslyAsked && f.newMedication && !f.costAsked) {
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
  const questionLike = /\?|como|qual|quanto|quando|quem|voce|senhora|me conte|me fale/.test(q);
  if (questionLike) {
    if (/nome|idade|quantos anos.*senhora/.test(q) && !/diabet/.test(q)) reply.push("identity");
    if (/trabalh|profissao|aposent/.test(q)) reply.push("occupation");
    if (/mora|quem.*ajuda|familia|filha|marido/.test(q)) reply.push("household");
    if (/diabet/.test(q) && /tempo|anos|quando/.test(q)) reply.push("diabetes");
    if (/doencas|problemas de saude/.test(q)) reply.push("conditions");
    if (/toma|usa|em uso/.test(q) && /remedio|medicamento|medicacao/.test(q))
      reply.push("medications");
    if (/aliment|comida|dieta|come/.test(q)) reply.push("diet");
    if (/atividade fisica|exercicio|caminha|sedentar/.test(q)) reply.push("exercise");
    if (/dor.*peito|dor torac/.test(q)) reply.push("chest");
    if (/falta de ar|dispneia/.test(q)) reply.push("breathing");
    if (/inchaco|edema/.test(q)) reply.push("swelling");
    if (/visao|visuais/.test(q)) reply.push("vision");
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
