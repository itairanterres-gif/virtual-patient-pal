import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCase, type ClinicalCase, type VitalStatus } from "@/lib/cases";
import { patientAvatars } from "@/lib/avatars";
import { askPatient, narrateFeedback } from "@/lib/patient.functions";
import { getEngineCase } from "@/lib/engine-registry";
import {
  clock,
  makeEvent,
  scoreSession,
  stageFromEvents,
  STAGE_LABELS,
  type ClinicalEvent,
  type EngineCase,
} from "@/lib/engine";

export const Route = createFileRoute("/caso/$id")({
  loader: ({ params }) => {
    const clinicalCase = getCase(params.id);
    if (!clinicalCase) throw notFound();
    return { clinicalCase };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.clinicalCase;
    const title = c ? `${c.patientName}, ${c.age}a — ${c.chiefComplaint} | Vitalis·Sim` : "Caso clínico | Vitalis·Sim";
    const description = c
      ? `Simulação de ${c.specialty.toLowerCase()} em ${c.environment.toLowerCase()}: converse com o paciente virtual, avalie sinais vitais, exames e defina a conduta.`
      : "Simulação clínica com paciente virtual.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: Cockpit,
});

type ChatMsg = { role: "student" | "patient" | "alert"; content: string; at: string };
type Feedback = { comentarios: Record<string, string>; resumo: string; melhorias: string[] };
type Pending = { dueAtSec: number; factIds: string[]; label: string; refId: string; source: "exame_fisico" | "exame_solicitado" };

const TABS = ["Anamnese", "Exame físico", "Exames", "Condutas"] as const;

function statusText(s: VitalStatus) {
  return s === "crit" ? "text-crit" : s === "warn" ? "text-warn" : "text-normal";
}

function Cockpit() {
  const { clinicalCase } = Route.useLoaderData();
  const engineCase = getEngineCase(clinicalCase.id)!;
  const ask = useServerFn(askPatient);
  const narrate = useServerFn(narrateFeedback);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Anamnese");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [hypothesis, setHypothesis] = useState("");
  const [pendingReply, setPendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ClinicalEvent[]>([]);
  const [revealedFacts, setRevealedFacts] = useState<string[]>([]);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const elapsedRef = useRef(0);
  elapsedRef.current = elapsed;

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pendingReply]);

  const factById = useMemo(
    () => Object.fromEntries(engineCase.patientTruth.facts.map((f) => [f.id, f])),
    [engineCase],
  );

  function pushEvent(e: ClinicalEvent) {
    setEvents((prev) => [...prev, e]);
  }

  // Resultados assíncronos: liberados quando o relógio da sessão os alcança.
  useEffect(() => {
    const due = queue.filter((q) => q.dueAtSec <= elapsed);
    if (due.length === 0) return;
    setQueue((q) => q.filter((item) => item.dueAtSec > elapsed));
    for (const item of due) {
      const facts = item.factIds.flatMap((id) => { const f = factById[id]; return f ? [f] : []; });
      setRevealedFacts((r) => [...r, ...item.factIds.filter((id) => !r.includes(id))]);
      for (const f of facts) {
        pushEvent(
          makeEvent("resultado", f.label, elapsed, {
            detail: f.content,
            refId: item.refId,
            status: f.initialState === "unavailable" ? "warn" : (f.status ?? "normal"),
          }),
        );
        setMessages((m) => [
          ...m,
          { role: "alert", content: `${f.label} — ${f.content}`, at: clock(elapsed) },
        ]);
      }
    }
  }, [elapsed, queue, factById]);

  const studentQuestions = messages.filter((m) => m.role === "student").map((m) => m.content);
  const stage = stageFromEvents(events, finished);

  async function send() {
    const question = input.trim();
    if (!question || pendingReply) return;
    const at = clock(elapsed);
    const transcript = messages
      .filter((m): m is ChatMsg & { role: "student" | "patient" } => m.role !== "alert")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, { role: "student", content: question, at }]);
    pushEvent(makeEvent("pergunta", question.slice(0, 90), elapsed));
    setInput("");
    setPendingReply(true);
    setError(null);

    try {
      const res = await ask({
        data: { caseId: clinicalCase.id, question, transcript, revealedFactIds: revealedFacts },
      });
      const now = elapsedRef.current;
      setMessages((m) => [...m, { role: "patient", content: res.reply, at: clock(now) }]);
      if (res.revealedFactIds.length) {
        setRevealedFacts((r) => [...r, ...res.revealedFactIds.filter((id) => !r.includes(id))]);
        pushEvent(
          makeEvent("resposta", `Informação obtida: ${res.revealedFactIds.map((id) => factById[id]?.label ?? id).join(", ")}`, now),
        );
      }
    } catch {
      setError("Não foi possível obter a resposta do paciente. Tente novamente em instantes.");
    } finally {
      setPendingReply(false);
    }
  }

  function doPhysicalExam(id: string) {
    const action = engineCase.physicalExams.find((p) => p.id === id);
    if (!action || events.some((e) => e.kind === "exame_fisico" && e.refId === id)) return;
    pushEvent(makeEvent("exame_fisico", `Exame físico: ${action.label}`, elapsed, { refId: id }));
    setQueue((q) => [
      ...q,
      { dueAtSec: elapsed + Math.max(1, Math.round(action.durationSec / 10)), factIds: action.reveals, label: action.label, refId: id, source: "exame_fisico" },
    ]);
  }

  function orderTest(id: string) {
    const test = engineCase.tests.find((t) => t.id === id);
    if (!test || events.some((e) => e.kind === "exame_solicitado" && e.refId === id)) return;
    pushEvent(makeEvent("exame_solicitado", `Exame solicitado: ${test.label}`, elapsed, { refId: id }));
    setQueue((q) => [
      ...q,
      { dueAtSec: elapsed + Math.max(1, Math.round(test.turnaroundSec / 5)), factIds: test.reveals, label: test.label, refId: id, source: "exame_solicitado" },
    ]);
  }

  function applyManagement(id: string) {
    const m = engineCase.managements.find((x) => x.id === id);
    if (!m || events.some((e) => e.kind === "conduta" && e.refId === id)) return;
    pushEvent(
      makeEvent("conduta", `Conduta: ${m.label}`, elapsed, {
        refId: id,
        status: m.appropriate ? "normal" : "crit",
      }),
    );
  }

  function registerHypothesis() {
    const h = hypothesis.trim();
    if (!h) return;
    pushEvent(makeEvent("hipotese", `Hipótese: ${h}`, elapsed, { detail: h, status: "warn" }));
    setHypothesis("");
  }

  const scores = useMemo(
    () => scoreSession(engineCase, { events, studentQuestions }),
    [engineCase, events, studentQuestions.join("|")],
  );

  async function finish() {
    setEvaluating(true);
    setError(null);
    setFinished(true);
    try {
      const res = await narrate({
        data: {
          caseId: clinicalCase.id,
          scores: scores.map((s) => ({
            domain: s.domain,
            label: s.label,
            score: s.score,
            met: s.met.map((m) => m.criterion.label),
            missed: s.missed.map((m) => m.criterion.label),
          })),
          timeline: events.map((e) => `${e.clock} · ${e.kind}: ${e.label}${e.detail ? ` — ${e.detail}` : ""}`),
        },
      });
      setFeedback(res as Feedback);
    } catch {
      setError("Não foi possível gerar a devolutiva narrativa; o placar objetivo continua abaixo.");
      setFeedback({ comentarios: {}, resumo: "", melhorias: [] });
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col bg-background font-sans text-foreground antialiased">
      <header className="sticky top-0 z-20 shrink-0 border-b border-line bg-background/95">
        <div className="flex items-center justify-between px-4 pt-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-sm bg-raise font-mono text-[11px] font-semibold text-normal ring-1 ring-normal/30">
              V
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">
                Vitalis<span className="text-faint">·</span>Sim
              </p>
              <p className="font-mono text-[10px] tracking-wide text-faint">COCKPIT CLÍNICO</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-md bg-raise px-2 py-1 font-mono text-[10px] text-warn ring-1 ring-line">
              <span className="pulse-dot size-1.5 rounded-full bg-warn" />
              AO VIVO
            </span>
            <button
              onClick={finish}
              disabled={evaluating}
              className="rounded-md bg-raise px-2.5 py-1.5 font-mono text-[11px] ring-1 ring-line disabled:opacity-50"
            >
              {evaluating ? "Avaliando…" : "Encerrar"}
            </button>
          </div>
        </div>
        <div className="mt-3 px-4">
          <div className="flex items-center justify-between gap-2 rounded-md bg-card px-3 py-2 ring-1 ring-line">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">
                {clinicalCase.patientName}, {clinicalCase.age}a — “{clinicalCase.chiefComplaint}”
              </p>
              <p className="truncate font-mono text-[10px] text-faint">
                {clinicalCase.specialty} · {STAGE_LABELS[stage]}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[13px] font-semibold">{clock(elapsed)}</p>
              <p className="font-mono text-[10px] text-faint">da sessão</p>
            </div>
          </div>
        </div>
      </header>

      <section className="shrink-0 px-4 pt-3">
        <div className="rounded-md bg-card p-3 ring-1 ring-line">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
              Sinais vitais — tempo real
            </p>
            <span className="pulse-dot size-1.5 rounded-full bg-normal" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {clinicalCase.vitals.map((v) => (
              <div key={v.label} className="rounded-md bg-raise px-2.5 py-2 ring-1 ring-line">
                <p className="font-mono text-[10px] text-faint">{v.label}</p>
                <p
                  className={`mt-1 font-mono text-lg leading-none font-semibold ${statusText(v.status)} ${v.pulse ? "pulse-vital" : ""}`}
                >
                  {v.value}
                </p>
                <p
                  className={`mt-1 font-mono text-[9px] ${v.status === "normal" ? "text-faint" : statusText(v.status)}`}
                >
                  {v.status === "normal" ? v.unit : `${v.status === "crit" ? "crítico" : "atenção"} ${v.unit}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <nav className="shrink-0 px-4 pt-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                t === tab
                  ? "shrink-0 rounded-md bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground"
                  : "shrink-0 rounded-md bg-raise px-3 py-1.5 text-[12px] ring-1 ring-line"
              }
            >
              {t}
            </button>
          ))}
        </div>
      </nav>

      <section className="flex min-h-0 flex-1 flex-col px-4 pt-3">
        {tab === "Anamnese" ? (
          <Conversa
            clinicalCase={clinicalCase}
            messages={messages}
            pending={pendingReply}
            scrollRef={scrollRef}
          />
        ) : (
          <Painel
            tab={tab}
            engineCase={engineCase}
            events={events}
            queue={queue}
            revealedFacts={revealedFacts}
            factById={factById}
            onExam={doPhysicalExam}
            onTest={orderTest}
            onManagement={applyManagement}
          />
        )}

        <div className="mt-2.5 shrink-0 rounded-md bg-card px-3 py-2.5 ring-1 ring-line">
          <p className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
            Hipótese diagnóstica
          </p>
          <div className="flex gap-2">
            <input
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && registerHypothesis()}
              placeholder="Registrar hipótese…"
              aria-label="Registrar hipótese diagnóstica"
              className="flex-1 rounded-md bg-raise px-2.5 py-2 text-[12px] outline-none ring-1 ring-line placeholder:text-faint"
            />
            <button
              onClick={registerHypothesis}
              className="rounded-md bg-raise px-3 text-[12px] ring-1 ring-line"
            >
              Registrar
            </button>
          </div>
        </div>

        <div className="mt-2.5 shrink-0">
          <div className="rounded-md bg-card px-3 py-2.5 ring-1 ring-line">
            <p className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
              Timeline de decisões
            </p>
            <div className="max-h-44 space-y-1.5 overflow-y-auto">
              {events.length === 0 && (
                <p className="text-[11px] text-faint">Nenhuma ação registrada ainda.</p>
              )}
              {events.map((e) => (
                <div key={e.id} className="flex items-start gap-2">
                  <span
                    className={`mt-1 size-2 shrink-0 rounded-full ${e.status === "crit" ? "bg-crit" : e.status === "warn" ? "bg-warn" : "bg-normal"}`}
                  />
                  <p className="text-[11px]">{e.label}</p>
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-faint">{e.clock}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <p className="mt-2 rounded-md bg-crit/10 px-3 py-2 font-mono text-[11px] text-crit ring-1 ring-crit/30">
            {error}
          </p>
        )}

        {finished && <Avaliacao scores={scores} feedback={feedback} evaluating={evaluating} />}

        <div className="mt-2.5 mb-4 flex shrink-0 items-center gap-2">
          <div className="flex flex-1 items-center rounded-md bg-card px-3 ring-1 ring-line">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              className="flex-1 bg-transparent py-2.5 text-[13px] outline-none placeholder:text-faint"
              placeholder="Pergunte ao paciente…"
              aria-label="Pergunte ao paciente"
            />
          </div>
          <button
            onClick={send}
            disabled={pendingReply}
            className="h-[42px] rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground ring-1 ring-primary/40 disabled:opacity-50"
          >
            {pendingReply ? "…" : "Enviar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function Conversa({
  clinicalCase,
  messages,
  pending,
  scrollRef,
}: {
  clinicalCase: ClinicalCase;
  messages: ChatMsg[];
  pending: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex min-h-[280px] flex-1 flex-col rounded-md bg-card ring-1 ring-line">
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        <img
          src={patientAvatars[clinicalCase.id]}
          alt={`Retrato de ${clinicalCase.patientName}`}
          width={512}
          height={512}
          className="size-9 shrink-0 rounded-md object-cover"
        />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold">Paciente — {clinicalCase.patientName}</p>
          <p className="truncate font-mono text-[10px] text-faint">
            {clinicalCase.age} anos · {clinicalCase.weightKg} kg · {clinicalCase.bed}
          </p>
        </div>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <p className="text-[12px] text-faint">
            Inicie a entrevista. O paciente só verbaliza o que sabe e o que você perguntar — achados
            objetivos aparecem apenas via exame físico e exames solicitados.
          </p>
        )}
        {messages.map((m, i) =>
          m.role === "alert" ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[82%] rounded-lg rounded-bl-sm bg-raise px-3 py-2 ring-1 ring-warn/25">
                <p className="mb-1 font-mono text-[11px] text-warn">Resultado disponível</p>
                <p className="text-[13px] text-pretty">{m.content}</p>
                <p className="mt-1 font-mono text-[9px] text-faint">alerta · {m.at}</p>
              </div>
            </div>
          ) : m.role === "student" ? (
            <div key={i} className="flex justify-start">
              <div className="max-w-[82%] rounded-lg rounded-bl-sm bg-raise px-3 py-2 ring-1 ring-line">
                <p className="text-[13px] text-pretty">{m.content}</p>
                <p className="mt-1 font-mono text-[9px] text-faint">você · {m.at}</p>
              </div>
            </div>
          ) : (
            <div key={i} className="flex justify-end">
              <div className="max-w-[78%] rounded-lg rounded-br-sm bg-primary/20 px-3 py-2 ring-1 ring-primary/30">
                <p className="text-[13px] text-pretty">{m.content}</p>
                <p className="mt-1 text-right font-mono text-[9px] text-faint">
                  {clinicalCase.patientName} · {m.at}
                </p>
              </div>
            </div>
          ),
        )}
        {pending && (
          <p className="pulse-vital font-mono text-[11px] text-faint">
            {clinicalCase.patientName} está respondendo…
          </p>
        )}
      </div>
    </div>
  );
}

function Painel({
  tab,
  engineCase,
  events,
  queue,
  revealedFacts,
  factById,
  onExam,
  onTest,
  onManagement,
}: {
  tab: (typeof TABS)[number];
  engineCase: EngineCase;
  events: ClinicalEvent[];
  queue: Pending[];
  revealedFacts: string[];
  factById: Record<string, { label: string; content: string; status?: VitalStatus }>;
  onExam: (id: string) => void;
  onTest: (id: string) => void;
  onManagement: (id: string) => void;
}) {
  if (tab === "Condutas") {
    return (
      <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-md bg-card p-3 ring-1 ring-line">
        <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          Condutas disponíveis
        </p>
        {engineCase.managements.map((m) => {
          const done = events.some((e) => e.kind === "conduta" && e.refId === m.id);
          return (
            <button
              key={m.id}
              onClick={() => onManagement(m.id)}
              disabled={done}
              className="w-full rounded-md bg-raise px-3 py-2.5 text-left text-[12px] ring-1 ring-line disabled:opacity-45"
            >
              {m.label}
              {done && <span className="ml-2 font-mono text-[10px] text-normal">executada</span>}
            </button>
          );
        })}
      </div>
    );
  }

  if (tab === "Exame físico") {
    return (
      <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-md bg-card p-3 ring-1 ring-line">
        <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          Manobras de exame físico
        </p>
        {engineCase.physicalExams.map((p) => {
          const done = events.some((e) => e.kind === "exame_fisico" && e.refId === p.id);
          const waiting = queue.some((q) => q.refId === p.id);
          const found = p.reveals.flatMap((id) => { const f = factById[id]; return f ? [f] : []; });
          const shown = p.reveals.some((id) => revealedFacts.includes(id));
          return (
            <button
              key={p.id}
              onClick={() => onExam(p.id)}
              disabled={done}
              className="w-full rounded-md bg-raise px-3 py-2.5 text-left ring-1 ring-line disabled:opacity-100"
            >
              <div className="flex items-center gap-2">
                <span className="text-[12px]">{p.label}</span>
                <span className="ml-auto font-mono text-[10px] text-faint">
                  {shown ? p.group : waiting ? "executando…" : "realizar"}
                </span>
              </div>
              {shown &&
                found.map((f) => (
                  <p key={f.label} className={`mt-1 font-mono text-[11px] ${statusText(f.status ?? "normal")}`}>
                    {f.content}
                  </p>
                ))}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-md bg-card p-3 ring-1 ring-line">
      <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
        Exames complementares
      </p>
      {engineCase.tests.map((t) => {
        const ordered = events.some((e) => e.kind === "exame_solicitado" && e.refId === t.id);
        const waiting = queue.some((q) => q.refId === t.id);
        const facts = t.reveals.flatMap((id) => { const f = factById[id]; return f ? [f] : []; });
        const ready = t.reveals.some((id) => revealedFacts.includes(id));
        return (
          <button
            key={t.id}
            onClick={() => onTest(t.id)}
            disabled={ordered}
            className="w-full rounded-md bg-raise px-3 py-2.5 text-left ring-1 ring-line disabled:opacity-100"
          >
            <div className="flex items-center gap-2">
              <span className="text-[12px]">{t.label}</span>
              <span className="ml-auto font-mono text-[10px] text-faint">
                {ready ? t.category : waiting ? "aguardando resultado…" : "solicitar"}
              </span>
            </div>
            {ready &&
              facts.map((f) => (
                <p key={f.label} className={`mt-1 font-mono text-[11px] ${statusText(f.status ?? "normal")}`}>
                  {f.content}
                </p>
              ))}
          </button>
        );
      })}
    </div>
  );
}

function Avaliacao({
  scores,
  feedback,
  evaluating,
}: {
  scores: ReturnType<typeof scoreSession>;
  feedback: Feedback | null;
  evaluating: boolean;
}) {
  return (
    <div className="mt-2.5 rounded-md bg-card p-3 ring-1 ring-line">
      <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
        Avaliação da sessão — baseada em evidências do event log
      </p>
      <div className="space-y-3">
        {scores.map((d) => (
          <div key={d.domain}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px]">{d.label}</span>
              <span
                className={`font-mono text-[11px] ${d.score >= 80 ? "text-normal" : d.score >= 60 ? "text-warn" : "text-crit"}`}
              >
                {d.score}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raise">
              <span
                className={`block h-full ${d.score >= 80 ? "bg-normal" : d.score >= 60 ? "bg-warn" : "bg-crit"}`}
                style={{ width: `${Math.max(2, Math.min(100, d.score))}%` }}
              />
            </div>
            {feedback?.comentarios[d.domain] && (
              <p className="mt-1 text-[11px] text-pretty text-faint">{feedback.comentarios[d.domain]}</p>
            )}
            <ul className="mt-1 space-y-0.5">
              {d.met.map((m) => (
                <li key={m.criterion.id} className="text-[11px] text-normal">
                  ✓ {m.criterion.label}
                </li>
              ))}
              {d.missed.map((m) => (
                <li key={m.criterion.id} className="text-[11px] text-crit">
                  ✕ {m.criterion.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {evaluating && (
        <p className="mt-3 font-mono text-[11px] text-faint">Gerando devolutiva narrativa…</p>
      )}
      {feedback?.resumo && (
        <p className="mt-3 border-t border-line pt-2 text-[12px] text-pretty">{feedback.resumo}</p>
      )}
      {feedback && feedback.melhorias.length > 0 && (
        <ul className="mt-2 space-y-1">
          {feedback.melhorias.map((m, i) => (
            <li key={i} className="text-[11px] text-pretty text-faint">
              → {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
