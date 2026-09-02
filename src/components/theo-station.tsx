import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { patientAvatars } from "@/lib/avatars";
import { theoGating, theoObjectiveFacts, theoProvenance } from "@/lib/case-theo";
import { askTheoActor } from "@/lib/theo.functions";
import { teamReply } from "@/lib/theo-actors";
import {
  AIR_LABEL,
  advanceTo,
  applyAction,
  buildDebrief,
  clockLabel,
  createTheoState,
  DEBRIEF_LABEL,
  EFFORT_LABEL,
  avaliarRaciocinio,
  avaliarTransferencia,
  CONFIANCA_LABEL,
  parseIntent,
  SPEECH_LABEL,
  THEO_CLOCK_FACTOR,
  WHEEZE_LABEL,
  type CausalEvent,
  type Confianca,
  type TheoAction,
  type TheoState,
} from "@/lib/theo-engine";

type Speaker = "theo" | "mae" | "equipe";
type Msg = { who: Speaker | "voce" | "sistema"; text: string; at: string; warn?: boolean };

const SPEAKERS: { id: Speaker; label: string }[] = [
  { id: "theo", label: "Théo" },
  { id: "mae", label: "Mãe" },
  { id: "equipe", label: "Equipe" },
];

const EVENT_TONE: Record<string, string> = {
  observacao: "text-fg",
  decisao: "text-primary",
  esclarecimento: "text-warn",
  confirmacao: "text-primary",
  execucao: "text-fg",
  efeito: "text-normal",
  evento_independente: "text-crit",
  comunicacao: "text-faint",
  transferencia: "text-warn",
  raciocinio: "text-primary",
};

export function TheoStation() {
  const ask = useServerFn(askTheoActor);
  const [state, setState] = useState<TheoState>(() => createTheoState());
  const [speaker, setSpeaker] = useState<Speaker>("theo");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [question, setQuestion] = useState("");
  const [action, setAction] = useState("");
  const [clarify, setClarify] = useState<Record<string, string>>({});
  const [waiting, setWaiting] = useState(false);
  const [showRaciocinio, setShowRaciocinio] = useState(false);
  const [representacao, setRepresentacao] = useState("");
  const [diferenciais, setDiferenciais] = useState("");
  const [confianca, setConfianca] = useState<Confianca>("media");
  const [showTransfer, setShowTransfer] = useState(false);
  const [destino, setDestino] = useState("");
  const [passagem, setPassagem] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  // Relógio clínico: o motor é dono do tempo. A UI só informa o alvo,
  // recalculado por diferença de timestamp (recupera suspensão da aba).
  const anchor = useRef({ real: Date.now(), clinical: 0 });
  const stateRef = useRef(state);
  stateRef.current = state;

  const commit = (next: TheoState) => {
    anchor.current = { real: Date.now(), clinical: next.clockSec };
    setState(next);
  };

  const dispatch = (a: TheoAction) => {
    const now = targetSec();
    commit(applyAction(stateRef.current, { ...a, atSec: now } as TheoAction));
  };

  function targetSec() {
    const elapsedReal = Math.floor((Date.now() - anchor.current.real) / 1000);
    return anchor.current.clinical + elapsedReal * THEO_CLOCK_FACTOR;
  }

  useEffect(() => {
    const t = setInterval(() => {
      const s = stateRef.current;
      if (s.frozen) return;
      const next = advanceTo(s, targetSec());
      if (next !== s) setState(next);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting]);

  const v = state.vitals;
  const debrief = useMemo(() => (state.frozen ? buildDebrief(state) : null), [state]);
  const openOrders = state.orders.filter(
    (o) => o.status !== "concluida" && o.status !== "cancelada",
  );
  const findings = state.revealedObjective.flatMap((id) => {
    const f = theoObjectiveFacts.find((x) => x.id === id);
    return f ? [f] : [];
  });

  async function sendQuestion() {
    const q = question.trim();
    if (!q || waiting || state.frozen) return;
    setQuestion("");
    setMessages((m) => [...m, { who: "voce", text: q, at: clockLabel(targetSec()) }]);

    if (speaker === "equipe") {
      const reply = teamReply(q);
      dispatch({ type: "fala", atSec: 0, actor: "equipe", question: q, reply, grounded: true });
      setMessages((m) => [...m, { who: "equipe", text: reply, at: clockLabel(targetSec()) }]);
      return;
    }

    setWaiting(true);
    try {
      const history = messages
        .slice(-10)
        .filter((m) => m.who === "voce" || m.who === speaker)
        .map((m) => ({
          role: (m.who === "voce" ? "student" : "actor") as "student" | "actor",
          content: m.text,
        }));
      const res = await ask({ data: { actor: speaker, question: q, transcript: history } });
      dispatch({
        type: "fala",
        atSec: 0,
        actor: speaker,
        question: q,
        reply: res.reply,
        grounded: res.grounded,
      });
      setMessages((m) => [
        ...m,
        { who: speaker, text: res.reply, at: clockLabel(targetSec()), warn: !res.grounded },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          who: "sistema",
          text: "Falha de comunicação. Tente novamente.",
          at: clockLabel(targetSec()),
          warn: true,
        },
      ]);
    } finally {
      setWaiting(false);
    }
  }

  function sendAction() {
    const raw = action.trim();
    if (!raw || state.frozen) return;
    setAction("");
    const intent = parseIntent(raw);
    if (intent.kind === "transferir") {
      setShowTransfer(true);
      return;
    }
    if (intent.kind === "exame") dispatch({ type: "exame", atSec: 0, raw });
    else if (intent.kind === "monitor") dispatch({ type: "monitor", atSec: 0 });
    else if (intent.kind === "reavaliar") dispatch({ type: "reavaliar", atSec: 0 });
    else if (intent.kind === "aguardar")
      dispatch({ type: "aguardar", atSec: 0, seconds: intent.seconds ?? 120 });
    else dispatch({ type: "ordem", atSec: 0, raw, intent });
  }

  // A UI espelha a validação do motor para não oferecer um botão que o motor
  // vai recusar. O motor continua sendo a autoridade: ele revalida.
  const faltasTransferencia = avaliarTransferencia(destino, passagem);
  const listaDiferenciais = diferenciais
    .split(/[\n;]/)
    .map((x) => x.trim())
    .filter(Boolean);
  const faltasRaciocinio = avaliarRaciocinio(representacao, listaDiferenciais, confianca);

  function confirmTransfer() {
    if (faltasTransferencia.length > 0) return;
    dispatch({ type: "transferir", atSec: 0, destino: destino.trim(), passagem: passagem.trim() });
    setShowTransfer(false);
  }

  function confirmRaciocinio() {
    if (faltasRaciocinio.length > 0) return;
    dispatch({
      type: "raciocinio",
      atSec: 0,
      representacao: representacao.trim(),
      diferenciais: listaDiferenciais,
      confianca,
    });
    setShowRaciocinio(false);
    setRepresentacao("");
    setDiferenciais("");
  }

  return (
    <div className="min-h-dvh bg-base text-fg">
      <div className="mx-auto w-full max-w-6xl px-3 py-3 lg:px-6 lg:py-5">
        <header className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-card p-3 ring-1 ring-line">
          <Link to="/" className="font-mono text-[11px] text-faint hover:text-fg">
            ← casos
          </Link>
          <img
            src={patientAvatars["dispneia-crianca"]}
            alt="Théo R."
            className="size-9 rounded-full object-cover"
          />
          <div className="min-w-0">
            <h1 className="truncate text-[13px] font-semibold">
              Théo R., 6 anos — dificuldade para respirar
            </h1>
            <p className="font-mono text-[10px] text-faint">
              Pronto-socorro pediátrico · tempo clínico {clockLabel(state.clockSec)}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {!state.frozen && (
              <button
                onClick={() => setShowTransfer(true)}
                className="rounded-md bg-raise px-3 py-2 font-mono text-[11px] ring-1 ring-line hover:ring-primary/40"
              >
                Transferir cuidado
              </button>
            )}
          </div>
        </header>

        {theoProvenance.statusCuracao !== "aprovado" && (
          <p className="mb-3 rounded-md bg-warn/10 px-3 py-2 text-[11px] text-warn ring-1 ring-warn/25">
            {theoProvenance.avisoCuracao}
          </p>
        )}

        {state.safetyEscalation && !state.frozen && (
          <div className="mb-3 rounded-md bg-crit/10 px-3 py-2 text-[12px] text-crit ring-1 ring-crit/30">
            Escalonamento de segurança acionado: a equipe chamou o pediatra plantonista.
            <button
              onClick={() => {
                setDestino("Pediatra plantonista (escalonamento de segurança)");
                setShowTransfer(true);
              }}
              className="ml-2 underline"
            >
              registrar passagem de cuidado
            </button>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
          <div className="order-2 min-w-0 space-y-3 lg:order-1">
            {/* Conversa */}
            <section className="rounded-md bg-card ring-1 ring-line">
              <div className="flex items-center gap-1.5 border-b border-line p-2">
                {SPEAKERS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSpeaker(s.id)}
                    className={`rounded-md px-3 py-1.5 font-mono text-[11px] ${speaker === s.id ? "bg-primary/20 text-fg ring-1 ring-primary/40" : "bg-raise text-faint ring-1 ring-line"}`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="ml-auto font-mono text-[10px] text-faint">falando com</span>
              </div>
              <div
                ref={chatRef}
                className="max-h-[46vh] min-h-[180px] space-y-2 overflow-y-auto p-3"
              >
                {messages.length === 0 && (
                  <p className="text-[12px] text-faint">
                    Converse livremente com Théo, com a mãe ou com a equipe. Cada um sabe apenas o
                    que lhe cabe saber.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={m.who === "voce" ? "flex justify-end" : "flex justify-start"}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ring-1 ${
                        m.who === "voce"
                          ? "bg-primary/20 ring-primary/30"
                          : m.warn
                            ? "bg-raise ring-warn/30"
                            : "bg-raise ring-line"
                      }`}
                    >
                      <p className="text-pretty">{m.text}</p>
                      <p className="mt-1 font-mono text-[9px] text-faint">
                        {m.who === "voce" ? "você" : m.who === "mae" ? "mãe" : m.who} · {m.at}
                      </p>
                    </div>
                  </div>
                ))}
                {waiting && (
                  <p className="pulse-vital font-mono text-[11px] text-faint">
                    aguardando resposta…
                  </p>
                )}
              </div>
              <div className="flex gap-2 border-t border-line p-2">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendQuestion()}
                  disabled={state.frozen}
                  placeholder={`Falar com ${SPEAKERS.find((s) => s.id === speaker)?.label}…`}
                  className="min-w-0 flex-1 rounded-md bg-raise px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
                />
                <button
                  onClick={sendQuestion}
                  disabled={state.frozen || waiting}
                  className="rounded-md bg-primary/25 px-3 py-2 font-mono text-[11px] ring-1 ring-primary/40 disabled:opacity-40"
                >
                  enviar
                </button>
              </div>
            </section>

            {/* Ação clínica em linguagem livre */}
            <section className="rounded-md bg-card p-3 ring-1 ring-line">
              <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                Ação clínica
              </p>
              <div className="flex gap-2">
                <input
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAction()}
                  disabled={state.frozen}
                  placeholder="Descreva o que você faz agora…"
                  className="min-w-0 flex-1 rounded-md bg-raise px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
                />
                <button
                  onClick={sendAction}
                  disabled={state.frozen}
                  className="rounded-md bg-raise px-3 py-2 font-mono text-[11px] ring-1 ring-line disabled:opacity-40"
                >
                  executar
                </button>
              </div>

              {/* Compromisso antes do dado: exame complementar exige raciocínio declarado. */}
              <div className="mt-3 rounded-md bg-raise p-2.5 ring-1 ring-line">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                    Raciocínio
                  </p>
                  {state.reasoning.length > 0 ? (
                    <span className="font-mono text-[10px] text-normal">
                      declarado {clockLabel(state.reasoning[state.reasoning.length - 1]!.atSec)} ·{" "}
                      {CONFIANCA_LABEL[state.reasoning[state.reasoning.length - 1]!.confianca]}
                    </span>
                  ) : theoGating.examesDecisivos.length > 0 ? (
                    <span className="font-mono text-[10px] text-warn">
                      exigido antes do exame decisivo deste caso
                    </span>
                  ) : (
                    <span className="font-mono text-[10px] text-faint">
                      não declarado — este caso não exige antes de exame
                    </span>
                  )}
                  <button
                    onClick={() => setShowRaciocinio((x) => !x)}
                    disabled={state.frozen}
                    className="ml-auto rounded-md bg-card px-2.5 py-1.5 font-mono text-[10px] ring-1 ring-line disabled:opacity-40"
                  >
                    {showRaciocinio ? "fechar" : "declarar"}
                  </button>
                </div>

                {showRaciocinio && !state.frozen && (
                  <div className="mt-2.5 space-y-2">
                    <textarea
                      value={representacao}
                      onChange={(e) => setRepresentacao(e.target.value)}
                      rows={3}
                      placeholder="Representação do problema: quem é este paciente e qual é o problema, em uma frase…"
                      className="w-full rounded-md bg-card px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
                    />
                    <textarea
                      value={diferenciais}
                      onChange={(e) => setDiferenciais(e.target.value)}
                      rows={3}
                      placeholder="Diagnósticos diferenciais, um por linha (mínimo dois)…"
                      className="w-full rounded-md bg-card px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] text-faint">confiança</span>
                      {(["baixa", "media", "alta"] as Confianca[]).map((c) => (
                        <button
                          key={c}
                          onClick={() => setConfianca(c)}
                          className={`rounded-md px-2.5 py-1.5 font-mono text-[10px] ring-1 ${
                            confianca === c
                              ? "bg-primary/25 ring-primary/40"
                              : "bg-card text-faint ring-line"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                      <button
                        onClick={confirmRaciocinio}
                        disabled={faltasRaciocinio.length > 0}
                        className="ml-auto rounded-md bg-primary/25 px-3 py-2 font-mono text-[11px] ring-1 ring-primary/40 disabled:opacity-40"
                      >
                        registrar
                      </button>
                    </div>
                    {faltasRaciocinio.length > 0 && (
                      <p className="text-[11px] text-warn">Falta: {faltasRaciocinio.join("; ")}.</p>
                    )}
                    <p className="text-[11px] text-faint">
                      O simulador registra que você declarou isto e quando. Se a representação está
                      correta, os diferenciais são pertinentes e a confiança está calibrada não é
                      avaliado automaticamente — é leitura do preceptor.
                    </p>
                  </div>
                )}
              </div>

              {openOrders.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                    Ordens em andamento
                  </p>
                  {openOrders.map((o) => (
                    <div key={o.id} className="rounded-md bg-raise p-2.5 ring-1 ring-line">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[12px]">{o.label}</span>
                        <span className="ml-auto font-mono text-[10px] text-faint">
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      {o.missing.length > 0 && (
                        <>
                          <p className="mt-1 text-[11px] text-warn">
                            A equipe pergunta: falta {o.missing.join("; ")}.
                          </p>
                          <div className="mt-1.5 flex gap-2">
                            <input
                              value={clarify[o.id] ?? ""}
                              onChange={(e) =>
                                setClarify((c) => ({ ...c, [o.id]: e.target.value }))
                              }
                              placeholder="Complete a ordem…"
                              className="min-w-0 flex-1 rounded-md bg-card px-2 py-1.5 text-[12px] ring-1 ring-line outline-none focus:ring-primary/40"
                            />
                            <button
                              onClick={() => {
                                const raw = (clarify[o.id] ?? "").trim();
                                if (!raw) return;
                                setClarify((c) => ({ ...c, [o.id]: "" }));
                                dispatch({ type: "esclarecer", atSec: 0, orderId: o.id, raw });
                              }}
                              className="rounded-md bg-card px-2.5 py-1.5 font-mono text-[10px] ring-1 ring-line"
                            >
                              responder
                            </button>
                          </div>
                        </>
                      )}
                      {o.status === "aguardando_confirmacao" && (
                        <div className="mt-1.5 flex gap-2">
                          <button
                            onClick={() => dispatch({ type: "confirmar", atSec: 0, orderId: o.id })}
                            className="rounded-md bg-primary/25 px-2.5 py-1.5 font-mono text-[10px] ring-1 ring-primary/40"
                          >
                            confirmar ordem
                          </button>
                          <button
                            onClick={() => dispatch({ type: "cancelar", atSec: 0, orderId: o.id })}
                            className="rounded-md bg-card px-2.5 py-1.5 font-mono text-[10px] text-faint ring-1 ring-line"
                          >
                            cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Achados obtidos */}
            {findings.length > 0 && (
              <section className="rounded-md bg-card p-3 ring-1 ring-line">
                <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                  Achados obtidos
                </p>
                <ul className="space-y-1">
                  {findings.map((f) => (
                    <li key={f.id} className="font-mono text-[11px]">
                      <span className="text-faint">{f.label}: </span>
                      {f.content}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {debrief && (
              <section className="rounded-md bg-card p-3 ring-1 ring-line">
                <p className="mb-1 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                  Debrief do Capi — comentário automático gerado a partir do registro
                </p>
                <p className="mb-3 text-[12px] text-faint">{debrief.encerramento}</p>
                <div className="space-y-3">
                  {debrief.itens.map((i) => (
                    <div key={i.id}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[12px]">{i.titulo}</span>
                        <span
                          className={`font-mono text-[10px] ${
                            i.status === "demonstrado"
                              ? "text-normal"
                              : i.status === "parcialmente"
                                ? "text-warn"
                                : i.status === "nao_observado"
                                  ? "text-crit"
                                  : "text-faint"
                          }`}
                        >
                          {DEBRIEF_LABEL[i.status]}
                        </span>
                      </div>
                      {i.evidencias.map((e, k) => (
                        <p key={k} className="mt-0.5 font-mono text-[10px] text-faint">
                          · {e}
                        </p>
                      ))}
                      {i.consequencia && (
                        <p className="mt-0.5 text-[11px] text-pretty">{i.consequencia}</p>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-line pt-2">
                  <p className="font-mono text-[10px] text-faint uppercase">
                    Não avaliável automaticamente
                  </p>
                  {debrief.naoAvaliavel.map((n, i) => (
                    <p key={i} className="mt-1 text-[11px] text-pretty text-faint">
                      → {n}
                    </p>
                  ))}
                </div>
                <button
                  onClick={() => setShowTrace((x) => !x)}
                  className="mt-3 rounded-md bg-raise px-2.5 py-1.5 font-mono text-[10px] ring-1 ring-line"
                >
                  {showTrace ? "ocultar" : "ver"} trace causal (revisão docente)
                </button>
                {showTrace && <Trace events={debrief.cronologia} />}
              </section>
            )}
          </div>

          {/* Monitor sempre visível */}
          <aside className="order-1 space-y-3 lg:order-2">
            <div className="rounded-md bg-card p-3 ring-1 ring-line lg:sticky lg:top-4">
              <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                Monitor
              </p>
              <div className="grid grid-cols-3 gap-2 lg:grid-cols-3">
                <Metric
                  label="SpO₂"
                  value={`${v.spo2}%`}
                  tone={v.spo2 >= 94 ? "normal" : v.spo2 >= 90 ? "warn" : "crit"}
                />
                <Metric label="FC" value={`${v.hr}`} tone={v.hr > 150 ? "warn" : "normal"} />
                <Metric
                  label="FR"
                  value={`${v.rr}`}
                  tone={v.rr > 40 ? "crit" : v.rr > 30 ? "warn" : "normal"}
                />
              </div>
              <ul className="mt-3 space-y-1 font-mono text-[11px]">
                <li className="text-faint">
                  sinal do oxímetro: <span className="text-fg">{v.oximeterSignal}</span>
                </li>
                <li className="text-faint">
                  fala: <span className="text-fg">{SPEECH_LABEL[v.speech]}</span>
                </li>
                <li className="text-faint">
                  esforço:{" "}
                  <span
                    className={
                      v.effort === "critico"
                        ? "text-crit"
                        : v.effort === "grave"
                          ? "text-warn"
                          : "text-fg"
                    }
                  >
                    {EFFORT_LABEL[v.effort]}
                  </span>
                </li>
                <li className="text-faint">
                  entrada de ar: <span className="text-fg">{AIR_LABEL[v.airEntry]}</span>
                </li>
                <li className="text-faint">
                  ausculta relatada:{" "}
                  <span className="text-fg">
                    {state.revealedObjective.includes("o-ausculta")
                      ? WHEEZE_LABEL[v.wheeze]
                      : "não avaliada"}
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-md bg-card p-3 ring-1 ring-line">
              <p className="mb-2 font-mono text-[10px] tracking-[0.12em] text-faint uppercase">
                Registro do encontro
              </p>
              <div className="max-h-[40vh] space-y-1.5 overflow-y-auto">
                {state.log.map((e) => (
                  <div key={e.id} className="font-mono text-[10px]">
                    <span className="text-faint">{clockLabel(e.atSec)} </span>
                    <span className={EVENT_TONE[e.type] ?? "text-fg"}>{e.label}</span>
                    {e.detail && <p className="pl-10 text-[10px] text-faint">{e.detail}</p>}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>

        {showTransfer && !state.frozen && (
          <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/60 p-3 sm:items-center">
            <div className="w-full max-w-md rounded-md bg-card p-4 ring-1 ring-line">
              <p className="mb-2 text-[13px] font-semibold">Transferir o cuidado</p>
              <p className="mb-3 text-[11px] text-faint">
                O encontro só encerra com destino e passagem de caso substantiva — ambos ficam
                registrados no event log.
              </p>
              <input
                value={destino}
                onChange={(e) => setDestino(e.target.value)}
                placeholder="Destino ou profissional responsável"
                className="mb-2 w-full rounded-md bg-raise px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
              />
              <textarea
                value={passagem}
                onChange={(e) => setPassagem(e.target.value)}
                rows={4}
                placeholder="Passagem de caso: situação, o que foi feito, o que fica pendente…"
                className="mb-2 w-full rounded-md bg-raise px-3 py-2 text-[13px] ring-1 ring-line outline-none focus:ring-primary/40"
              />
              {faltasTransferencia.length > 0 && (
                <p className="mb-3 text-[11px] text-warn">
                  Falta: {faltasTransferencia.join("; ")}.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={confirmTransfer}
                  disabled={faltasTransferencia.length > 0}
                  className="flex-1 rounded-md bg-primary/25 px-3 py-2 font-mono text-[11px] ring-1 ring-primary/40 disabled:opacity-40"
                >
                  transferir e encerrar
                </button>
                <button
                  onClick={() => setShowTransfer(false)}
                  className="rounded-md bg-raise px-3 py-2 font-mono text-[11px] text-faint ring-1 ring-line"
                >
                  voltar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "normal" | "warn" | "crit";
}) {
  const color = tone === "crit" ? "text-crit" : tone === "warn" ? "text-warn" : "text-normal";
  return (
    <div className="rounded-md bg-raise px-2 py-2 ring-1 ring-line">
      <p className="font-mono text-[9px] text-faint">{label}</p>
      <p className={`font-mono text-[18px] leading-tight ${color}`}>{value}</p>
    </div>
  );
}

function Trace({ events }: { events: CausalEvent[] }) {
  return (
    <div className="mt-2 space-y-1 rounded-md bg-raise p-2 ring-1 ring-line">
      {events.map((e) => (
        <p key={e.id} className="font-mono text-[10px]">
          <span className="text-faint">
            {e.id} · {clockLabel(e.atSec)} · {e.type}
            {e.causeId ? ` ← ${e.causeId}` : ""}
            {e.orderId ? ` · ${e.orderId}` : ""}:{" "}
          </span>
          {e.label}
          {e.detail ? ` — ${e.detail}` : ""}
        </p>
      ))}
    </div>
  );
}
