import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getCase, type ClinicalCase, type VitalStatus } from "@/lib/cases";
import { patientAvatars } from "@/lib/avatars";
import { askPatient, evaluateSession } from "@/lib/patient.functions";
import type { Turn } from "@/lib/prompts";

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
type Score = { nota: number; comentario: string };
type Evaluation = {
  rapport: Score;
  anamnese: Score;
  raciocinio: Score;
  diagnostico: Score;
  conduta: Score;
  resumo: string;
};

const TABS = ["Anamnese", "Exame físico", "Exames", "Condutas"] as const;

function statusText(s: VitalStatus) {
  return s === "crit" ? "text-crit" : s === "warn" ? "text-warn" : "text-normal";
}

function clock(seconds: number) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function Cockpit() {
  const { clinicalCase } = Route.useLoaderData();
  const ask = useServerFn(askPatient);
  const evaluate = useServerFn(evaluateSession);

  const [tab, setTab] = useState<(typeof TABS)[number]>("Anamnese");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<{ label: string; status: VitalStatus; at: string }[]>([
    { label: "Triagem inicial realizada", status: "normal", at: "00:00" },
  ]);
  const [revealed, setRevealed] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const studentTurns = messages.filter((m) => m.role === "student").length;
  const gated = studentTurns < 3;

  function log(label: string, status: VitalStatus) {
    setTimeline((t) => [...t, { label, status, at: clock(elapsed) }]);
  }

  async function send() {
    const question = input.trim();
    if (!question || pending) return;
    const at = clock(elapsed);
    const transcript: Turn[] = messages
      .filter((m): m is ChatMsg & { role: "student" | "patient" } => m.role !== "alert")
      .map((m) => ({ role: m.role, content: m.content }));

    setMessages((m) => [...m, { role: "student", content: question, at }]);
    setInput("");
    setPending(true);
    setError(null);

    try {
      const { reply } = await ask({ data: { caseId: clinicalCase.id, question, transcript } });
      setMessages((m) => [...m, { role: "patient", content: reply, at: clock(elapsed) }]);
      if (transcript.length === 0) log("Anamnese iniciada", "normal");
    } catch {
      setError("Não foi possível obter a resposta do paciente. Tente novamente em instantes.");
    } finally {
      setPending(false);
    }
  }

  function reveal(name: string, result: string, status: VitalStatus, kind: string) {
    if (revealed.includes(name)) return;
    setRevealed((r) => [...r, name]);
    log(`${kind}: ${name}`, status);
    setMessages((m) => [
      ...m,
      { role: "alert", content: `${name} — ${result}`, at: clock(elapsed) },
    ]);
  }

  async function finish() {
    setEvaluating(true);
    setError(null);
    try {
      const transcript: Turn[] = messages
        .filter((m): m is ChatMsg & { role: "student" | "patient" } => m.role !== "alert")
        .map((m) => ({ role: m.role, content: m.content }));
      const result = await evaluate({ data: { caseId: clinicalCase.id, transcript } });
      setEvaluation(result as Evaluation);
    } catch {
      setError("Não foi possível gerar a avaliação agora.");
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
                {clinicalCase.specialty} · Dificuldade {clinicalCase.difficulty}/5
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
            pending={pending}
            scrollRef={scrollRef}
          />
        ) : (
          <Painel
            tab={tab}
            clinicalCase={clinicalCase}
            gated={gated}
            revealed={revealed}
            onReveal={reveal}
          />
        )}

        <div className="mt-2.5 shrink-0">
          <div className="rounded-md bg-card px-3 py-2.5 ring-1 ring-line">
            <p className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
              Timeline de decisões
            </p>
            <div className="space-y-1.5">
              {timeline.map((t, i) => (
                <div key={`${t.label}-${i}`} className="flex items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${t.status === "crit" ? "bg-crit" : t.status === "warn" ? "bg-warn pulse-dot" : "bg-normal"}`}
                  />
                  <p className="text-[11px]">{t.label}</p>
                  <span className="ml-auto font-mono text-[10px] text-faint">{t.at}</span>
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

        {evaluation && <Avaliacao evaluation={evaluation} />}

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
            disabled={pending}
            className="h-[42px] rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground ring-1 ring-primary/40 disabled:opacity-50"
          >
            {pending ? "…" : "Enviar"}
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
            Inicie a entrevista. O paciente só revela o que você perguntar — exames ficam bloqueados
            até a anamnese avançar.
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
  clinicalCase,
  gated,
  revealed,
  onReveal,
}: {
  tab: (typeof TABS)[number];
  clinicalCase: ClinicalCase;
  gated: boolean;
  revealed: string[];
  onReveal: (name: string, result: string, status: VitalStatus, kind: string) => void;
}) {
  if (tab === "Condutas") {
    return (
      <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-md bg-card p-3 ring-1 ring-line">
        <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
          Condutas disponíveis
        </p>
        {clinicalCase.managements.map((m) => (
          <button
            key={m}
            onClick={() => onReveal(m, "conduta aplicada", "normal", "Conduta")}
            disabled={revealed.includes(m)}
            className="w-full rounded-md bg-raise px-3 py-2.5 text-left text-[12px] ring-1 ring-line disabled:opacity-45"
          >
            {m}
            {revealed.includes(m) && (
              <span className="ml-2 font-mono text-[10px] text-normal">aplicada</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  const items = tab === "Exame físico" ? clinicalCase.physicalExam : clinicalCase.labs;
  const blocked = tab === "Exames" && gated;

  return (
    <div className="min-h-[280px] flex-1 space-y-2 overflow-y-auto rounded-md bg-card p-3 ring-1 ring-line">
      <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
        {tab === "Exames" ? "Exames complementares" : "Achados por sistema"}
      </p>
      {blocked && (
        <p className="rounded-md bg-raise px-3 py-2 font-mono text-[11px] text-warn ring-1 ring-warn/25">
          Bloqueado: complete a anamnese (≥ 3 perguntas) antes de solicitar exames.
        </p>
      )}
      {items.map((item) => {
        const open = revealed.includes(item.name);
        return (
          <button
            key={item.name}
            onClick={() => onReveal(item.name, item.result, item.status, tab)}
            disabled={blocked}
            className="w-full rounded-md bg-raise px-3 py-2.5 text-left ring-1 ring-line disabled:opacity-45"
          >
            <div className="flex items-center gap-2">
              <span className="text-[12px]">{item.name}</span>
              <span
                className={`ml-auto font-mono text-[10px] ${open ? statusText(item.status) : "text-faint"}`}
              >
                {open ? (item.status === "normal" ? "normal" : item.status === "warn" ? "atenção" : "crítico") : "solicitar"}
              </span>
            </div>
            {open && <p className="mt-1 font-mono text-[11px] text-faint">{item.result}</p>}
          </button>
        );
      })}
    </div>
  );
}

function Avaliacao({ evaluation }: { evaluation: Evaluation }) {
  const domains: [string, Score][] = [
    ["Rapport", evaluation.rapport],
    ["Anamnese", evaluation.anamnese],
    ["Raciocínio clínico", evaluation.raciocinio],
    ["Diagnóstico", evaluation.diagnostico],
    ["Conduta", evaluation.conduta],
  ];
  return (
    <div className="mt-2.5 rounded-md bg-card p-3 ring-1 ring-line">
      <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
        Avaliação da sessão
      </p>
      <div className="space-y-2.5">
        {domains.map(([label, d]) => (
          <div key={label}>
            <div className="flex items-baseline justify-between">
              <span className="text-[12px]">{label}</span>
              <span
                className={`font-mono text-[11px] ${d.nota >= 80 ? "text-normal" : d.nota >= 60 ? "text-warn" : "text-crit"}`}
              >
                {Math.round(d.nota)}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-raise">
              <span
                className={`block h-full ${d.nota >= 80 ? "bg-normal" : d.nota >= 60 ? "bg-warn" : "bg-crit"}`}
                style={{ width: `${Math.max(2, Math.min(100, d.nota))}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-pretty text-faint">{d.comentario}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 border-t border-line pt-2 text-[12px] text-pretty">{evaluation.resumo}</p>
    </div>
  );
}
