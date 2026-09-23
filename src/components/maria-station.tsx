import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PV001 } from "@/lib/pv001/case";
import { newSessionId } from "@/lib/pv001/session-id";
import {
  advance,
  consultResource,
  createSession,
  finish,
  recordDecision,
  reflect,
  respond,
  type Session,
} from "@/lib/pv001/engine";
import { CHECKLIST, validateReview, type Judgment, type Status } from "@/lib/pv001/evaluator";
import { evaluateMaria } from "@/lib/pv001/evaluation.functions";
import {
  loadRecord,
  saveRecord,
  sessionIndex,
  STORAGE_PREFIX,
  type RecordEnvelope,
} from "@/lib/pv001/persistence";
import {
  recognitionConstructor,
  speak,
  stopSpeech,
  availableVoices,
  microphoneMessage,
  openMicrophone,
  recordMicrophone,
  playNaturalSpeech,
  type Recognition,
  type Recording,
} from "@/lib/pv001/voice";
import {
  audioCapabilities,
  renderMariaSpeech,
  transcribeStudent,
} from "@/lib/pv001/audio.functions";

const box = "rounded-md bg-card p-4 ring-1 ring-line";
const button = "rounded-md bg-raise px-4 py-2 text-sm ring-1 ring-line disabled:opacity-40";
const field = "w-full rounded-md bg-raise p-3 text-sm ring-1 ring-line";
const clock = (n: number) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;

function download(record: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(record, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function MariaStation() {
  const [record, setRecord] = useState<RecordEnvelope | null>(null);
  const current = useRef(record);
  const [participant, setParticipant] = useState("");
  const [ready, setReady] = useState(false);
  const [input, setInput] = useState("");
  const [decision, setDecision] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [intro, setIntro] = useState(false);
  const [voice, setVoice] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [naturalVoice, setNaturalVoice] = useState(false);
  const [voiceURI, setVoiceURI] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [micStatus, setMicStatus] = useState("Verificando compatibilidade de áudio…");
  const [micPending, setMicPending] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reflection, setReflection] = useState("");
  const [debrief, setDebrief] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [reviewItems, setReviewItems] = useState<Judgment[]>([]);
  const [saved, setSaved] = useState<ReturnType<typeof sessionIndex>>([]);
  const recognition = useRef<Recognition | null>(null);
  const recording = useRef<Recording | null>(null);
  const voiceGeneration = useRef(0);
  const chat = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const evaluate = useServerFn(evaluateMaria);
  const capabilities = useServerFn(audioCapabilities);
  const renderSpeech = useServerFn(renderMariaSpeech);
  const transcribe = useServerFn(transcribeStudent);

  const commit = useCallback((next: RecordEnvelope) => {
    // Ref is updated synchronously: timer, speech and text always use the same latest state.
    current.current = next;
    try {
      saveRecord(localStorage, next);
    } catch {
      const event = {
        atSec: next.session.elapsedSec,
        type: "storage_error",
        detail: "Falha de gravação local; exportação necessária",
        turn: null,
      };
      if (next.session.technicalEvents.at(-1)?.type !== event.type)
        next.session.technicalEvents.push(event);
      setError("Não foi possível salvar neste navegador. Exporte a sessão antes de sair.");
    }
    setRecord(next);
  }, []);
  const technical = useCallback(
    (type: string, detail: string) => {
      const value = current.current;
      if (!value) return;
      const next = structuredClone(value);
      next.session.technicalEvents.push({
        atSec: next.session.elapsedSec,
        type,
        detail,
        turn: null,
      });
      commit(next);
    },
    [commit],
  );
  const stopVoice = useCallback(() => {
    voiceGeneration.current++;
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.onresult = null;
      recognition.current.onerror = null;
      recognition.current.abort();
    }
    recognition.current = null;
    recording.current?.cancel();
    recording.current = null;
    setListening(false);
    setMicPending(false);
    setTranscribing(false);
    stopSpeech();
  }, []);
  useEffect(() => {
    setReady(true);
    try {
      setSaved(sessionIndex(localStorage));
    } catch {
      setError("Armazenamento local indisponível; use exportação da sessão.");
    }
    const timer = window.setInterval(() => {
      const value = current.current;
      if (!value || value.session.mode !== "patient_mode") return;
      const next = advance(value.session);
      if (next !== value.session) {
        if (next.mode !== "patient_mode") stopVoice();
        commit({ ...value, session: next });
      }
    }, 1000);
    return () => {
      clearInterval(timer);
      stopVoice();
    };
  }, [commit, stopVoice]);
  useEffect(() => {
    let mounted = true;
    const refreshVoices = () => setVoices(availableVoices());
    refreshVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", refreshVoices);
    const setup = (natural: boolean) => {
      if (!mounted) return;
      setNaturalVoice(natural);
      const secure = window.isSecureContext;
      const capture = !!navigator.mediaDevices?.getUserMedia;
      const supported =
        !!recognitionConstructor() || (natural && typeof MediaRecorder !== "undefined");
      setVoiceAvailable(secure && capture && supported);
      setMicStatus(
        !secure
          ? "Este endereço HTTP da rede bloqueia o microfone. No computador, use http://127.0.0.1:4173/caso/PV-001. No iPhone, é necessário um endereço HTTPS."
          : !capture
            ? "Este navegador não permite capturar áudio. Abra o endereço da consulta no Edge ou Chrome do computador."
            : !supported
              ? "Este navegador não oferece reconhecimento de fala e a transcrição alternativa ainda não está configurada. Abra a consulta no Edge ou Chrome. Você pode testar o microfone abaixo."
              : "Teste o microfone antes de começar. Durante a consulta, clique em Falar com Maria e depois em Concluir fala.",
      );
    };
    void capabilities()
      .then((value) => setup(value.natural))
      .catch(() => setup(false));
    return () => {
      mounted = false;
      window.speechSynthesis?.removeEventListener("voiceschanged", refreshVoices);
    };
  }, [capabilities]);
  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight, behavior: "smooth" });
  }, [record?.session.transcript.length]);

  function start() {
    if (current.current || !participant.trim()) return;
    setIntro(false);
    commit({
      session: createSession(participant, newSessionId()),
      evaluation: null,
      reviews: [],
    });
  }
  async function sayPatient(turn: Session["transcript"][number], emotion: Session["emotion"]) {
    const generation = voiceGeneration.current;
    const failed = () => {
      setNotice(
        "Não foi possível tocar a resposta. Ela permanece na transcrição; use Ouvir novamente.",
      );
      technical("speech_error", "Reprodução indisponível");
    };
    if (!naturalVoice) {
      speak(turn.text, failed, voiceURI);
      return;
    }
    try {
      const audio = await renderSpeech({ data: { lineIds: turn.lineIds, emotion } });
      if (
        generation !== voiceGeneration.current ||
        current.current?.session.mode !== "patient_mode"
      )
        return;
      await playNaturalSpeech(audio);
    } catch {
      if (generation === voiceGeneration.current) failed();
    }
  }
  async function testMicrophone() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return;
    stopVoice();
    const generation = voiceGeneration.current;
    setMicPending(true);
    setMicStatus("Aguardando permissão do navegador para testar o microfone…");
    try {
      const stream = await openMicrophone();
      const label = stream.getAudioTracks()[0]?.label;
      stream.getTracks().forEach((track) => track.stop());
      if (generation !== voiceGeneration.current) return;
      setMicStatus(
        `Microfone acessível${label ? `: ${label}` : ""}. ${voiceAvailable ? "Pronto para iniciar uma fala." : "Falta o serviço de reconhecimento neste navegador; abra no Edge ou Chrome."}`,
      );
    } catch (error) {
      if (generation === voiceGeneration.current) setMicStatus(microphoneMessage(error));
    } finally {
      if (generation === voiceGeneration.current) setMicPending(false);
    }
  }
  function send(text = input) {
    const value = current.current;
    if (!value || !text.trim()) return;
    stopVoice();
    setInput("");
    try {
      const next = respond(value.session, text);
      commit({ ...value, session: next });
      const last = next.transcript.at(-1);
      if (voice && next.mode === "patient_mode" && last?.role === "patient")
        void sayPatient(last, next.emotion);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function listen() {
    if (listening) {
      recording.current?.stop();
      recognition.current?.stop();
      return;
    }
    if (
      !voiceAvailable ||
      micPending ||
      transcribing ||
      current.current?.session.mode !== "patient_mode"
    )
      return;
    stopVoice();
    const generation = voiceGeneration.current;
    setMicPending(true);
    setMicStatus("Aguardando acesso ao microfone…");
    let stream: MediaStream;
    try {
      stream = await openMicrophone();
    } catch (error) {
      if (generation === voiceGeneration.current) {
        setMicPending(false);
        setMicStatus(microphoneMessage(error));
      }
      return;
    }
    if (
      generation !== voiceGeneration.current ||
      current.current?.session.mode !== "patient_mode"
    ) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    setMicPending(false);
    setMicStatus(
      naturalVoice
        ? "Ouvindo… Clique em Concluir fala quando terminar. Cada gravação dura até 45 segundos."
        : "Ouvindo… Clique em Concluir fala quando terminar. O navegador também pode enviar a fala ao detectar uma pausa.",
    );
    if (naturalVoice && typeof MediaRecorder !== "undefined") {
      try {
        const capture = recordMicrophone(stream);
        recording.current = capture;
        setListening(true);
        const blob = await capture.result;
        if (generation !== voiceGeneration.current) return;
        recording.current = null;
        setListening(false);
        if (!blob?.size) {
          setMicStatus("Gravação vazia ou acima do limite. Tente uma fala mais curta.");
          return;
        }
        setTranscribing(true);
        setMicStatus("Transcrevendo sua fala…");
        const data = new FormData();
        data.append("audio", blob, "fala");
        const text = await transcribe({ data });
        if (
          generation !== voiceGeneration.current ||
          current.current?.session.mode !== "patient_mode"
        )
          return;
        setTranscribing(false);
        setMicStatus(
          text
            ? "Fala transcrita e enviada. Você pode iniciar a próxima fala."
            : "Nenhuma fala reconhecida. Tente novamente.",
        );
        if (text) send(text);
      } catch {
        if (generation === voiceGeneration.current) {
          setListening(false);
          setTranscribing(false);
          setMicStatus("Não foi possível transcrever. Tente novamente ou use o texto.");
        }
      }
      return;
    }
    stream.getTracks().forEach((track) => track.stop());
    const Constructor = recognitionConstructor();
    if (!Constructor || current.current?.session.mode !== "patient_mode") return;
    stopSpeech();
    const rec = new Constructor();
    recognition.current = rec;
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;
    let final = "";
    rec.onresult = (event) => {
      if (generation !== voiceGeneration.current) return;
      let draft = "";
      final = "";
      for (const result of Array.from(event.results)) {
        draft += result[0].transcript;
        if (result.isFinal) final += result[0].transcript;
      }
      setInput(draft);
    };
    rec.onerror = (event) => {
      setMicStatus(microphoneMessage(event.error));
      technical("recognition_error", event.error);
      final = "";
    };
    rec.onend = () => {
      if (generation !== voiceGeneration.current) return;
      recognition.current = null;
      setListening(false);
      // Never deliver a delayed speech result after the timer has closed the encounter.
      if (final.trim() && current.current?.session.mode === "patient_mode") {
        setMicStatus("Fala enviada. Você pode iniciar a próxima fala.");
        send(final);
      }
    };
    try {
      rec.start();
      setListening(true);
    } catch (error) {
      setListening(false);
      setMicStatus(microphoneMessage(error));
      technical("microphone_error", "Não foi possível iniciar captura");
    }
  }
  async function runEvaluation() {
    const value = current.current;
    if (!value || value.session.mode !== "debriefing_mode" || busy) return;
    setBusy(true);
    try {
      const result = await evaluate({
        data: {
          case_id: value.session.case_id,
          case_version: value.session.case_version,
          sessionId: value.session.sessionId,
          mode: value.session.mode,
          transcript: value.session.transcript,
        },
      });
      const latest = current.current;
      if (latest?.session.sessionId === value.session.sessionId) {
        commit({ ...latest, evaluation: result });
        setReviewItems(result.items);
        if (result.source === "unavailable") {
          setNotice(
            "Sugestão automática indisponível; revisão humana pode ser preenchida com a transcrição.",
          );
          technical("evaluation_unavailable", "Avaliador indisponível");
        }
      }
    } catch {
      setError("Não foi possível solicitar a avaliação. A sessão permanece salva.");
      technical("evaluation_error", "Falha ao solicitar avaliador");
    } finally {
      setBusy(false);
    }
  }
  const s = record?.session;
  const active = s?.mode === "patient_mode";
  const audioSettings = (
    <section className={`${box} space-y-3`} aria-label="Áudio e microfone">
      <h2 className="font-semibold">Áudio e microfone</h2>
      <p className="text-sm" role="status">
        {micStatus}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          className={button}
          disabled={!ready || micPending || listening || transcribing}
          onClick={testMicrophone}
        >
          {micPending ? "Aguardando permissão…" : "Testar microfone"}
        </button>
        <button
          className={button}
          disabled={!ready || listening || micPending || transcribing}
          onClick={() =>
            speak(
              "Olá, sou Maria. Você consegue me ouvir?",
              () => setNotice("Não foi possível reproduzir áudio neste navegador."),
              voiceURI,
            )
          }
        >
          Testar som do navegador
        </button>
      </div>
      {!naturalVoice && (
        <label className="block text-sm">
          Voz de Maria no navegador
          <select
            className={`${field} mt-1`}
            value={voiceURI}
            onChange={(e) => {
              stopSpeech();
              setVoiceURI(e.target.value);
            }}
          >
            <option value="">Automática — português brasileiro</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-xs">
        {naturalVoice
          ? "Voz sintética natural ativada. Suas gravações serão enviadas à OpenAI para transcrição; esta aplicação conserva a transcrição, sem salvar o áudio."
          : "Voz sintética do navegador. A voz natural ainda não foi ativada nesta prévia. O reconhecimento do navegador pode processar sua fala externamente."}
      </p>
    </section>
  );
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-4 bg-background px-4 py-5 text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/" className="text-sm underline">
            Biblioteca de casos
          </Link>
          <h1 className="mt-2 text-xl font-semibold">{PV001.publicTitle}</h1>
          <p className="text-sm text-faint">PV-001 · v1.1 · {PV001.environment}</p>
        </div>
        {s && (
          <div className="text-right">
            <p aria-label="Tempo restante" className="font-mono text-2xl">
              {clock(active ? 900 - s.elapsedSec : s.elapsedSec)}
            </p>
            <p className="text-sm">{active ? "restantes" : "duração · cenário encerrado"}</p>
          </div>
        )}
      </header>
      {error && (
        <p role="alert" className="rounded bg-crit/10 p-3">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded bg-raise p-3">
          {notice}
        </p>
      )}
      {!s && !intro && (
        <section className={`${box} space-y-4`}>
          <h2 className="text-lg font-semibold">Antes de começar</h2>
          <p>{PV001.briefing}</p>
          <ul className="list-disc space-y-2 pl-5">
            {PV001.prebriefing.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
          <p className="text-sm">
            Duração: 15 minutos após a abertura. A sessão é salva neste navegador e pode ser
            exportada. Em computador compartilhado, exporte e encerre o perfil do navegador ao
            terminar.
          </p>
          <label className="block">
            Código do participante
            <input
              className={`${field} mt-2`}
              maxLength={80}
              disabled={!ready}
              value={participant}
              onChange={(e) => setParticipant(e.target.value)}
              placeholder="Ex.: interno-01"
            />
          </label>
          {audioSettings}
          <button className={button} disabled={!participant.trim()} onClick={() => setIntro(true)}>
            Iniciar abertura
          </button>
          {saved.length > 0 && (
            <details>
              <summary>Sessões salvas neste navegador</summary>
              <ul className="mt-3 space-y-3">
                {saved.map((item) => (
                  <li key={item.id} className="flex flex-wrap gap-3">
                    <span>
                      {item.student} · v{item.version} · {new Date(item.at).toLocaleString("pt-BR")}
                    </span>
                    <button
                      className={button}
                      onClick={() => {
                        try {
                          const value = loadRecord(localStorage, item.id);
                          if (value) {
                            commit({ ...value, session: advance(value.session) });
                            setReviewItems(value.evaluation?.items ?? []);
                          }
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Retomar
                    </button>
                    <button
                      className={button}
                      onClick={() => {
                        const raw = localStorage.getItem(STORAGE_PREFIX + item.id);
                        if (raw) download(JSON.parse(raw), `${item.id}.json`);
                      }}
                    >
                      Exportar
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}
      {intro && (
        <section className={`${box} space-y-3`}>
          <video
            ref={video}
            className="w-full rounded"
            src="/pv001/v1.1/intro-neutral.mp4"
            poster="/pv001/v1.1/maria.png"
            autoPlay
            playsInline
            controls
            onEnded={start}
            onError={() =>
              setNotice("Vídeo indisponível. Você pode iniciar com a fala transcrita.")
            }
          >
            <track
              kind="captions"
              src="/pv001/v1.1/intro-neutral.vtt"
              srcLang="pt-BR"
              label="Português"
              default
            />
          </video>
          <p className="text-sm">
            Paciente fictícia. Abertura audiovisual com imagem e voz sintéticas.
          </p>
          <button className={button} onClick={start}>
            Continuar para a consulta
          </button>
        </section>
      )}
      {s && (
        <>
          <div className="grid items-start gap-4 md:grid-cols-[minmax(240px,1fr)_2fr]">
            <aside className="space-y-4">
              <img
                src="/pv001/v1.1/maria.png"
                alt="Maria, paciente fictícia, sentada no ambulatório segurando a bolsa"
                className="w-full rounded-md"
              />
              {active && audioSettings}
              <section className={`${box} space-y-2`}>
                <h2 className="font-semibold">Recursos da consulta</h2>
                {(Object.keys(PV001.resources) as (keyof typeof PV001.resources)[]).map((id) => (
                  <button
                    key={id}
                    className={`${button} w-full text-left`}
                    disabled={!active}
                    onClick={() => {
                      const value = current.current!;
                      commit({ ...value, session: consultResource(value.session, id) });
                    }}
                  >
                    {id === "exames"
                      ? "Exames atuais e anteriores"
                      : id === "pressao"
                        ? "Pressão arterial"
                        : "Medicamentos em uso"}
                  </button>
                ))}
                <p className="text-xs">
                  Outras informações e exames podem ser solicitados em texto livre. Resultados não
                  previstos não serão inventados.
                </p>
              </section>
            </aside>
            <section className={`${box} space-y-3`}>
              <h2 className="font-semibold">
                {active ? "Consulta com Maria" : "Transcrição da consulta"}
              </h2>
              <div
                ref={chat}
                className="max-h-[55vh] min-h-48 space-y-3 overflow-y-auto"
                aria-live="polite"
                aria-relevant="additions"
              >
                {s.transcript.map((turn) => (
                  <article
                    key={turn.turn}
                    className={`rounded p-3 ${turn.role === "student" ? "bg-primary/10" : "bg-raise"}`}
                  >
                    <p className="mb-1 text-xs text-faint">
                      {turn.role === "student"
                        ? "Você"
                        : turn.role === "patient"
                          ? "Maria"
                          : "Sistema"}{" "}
                      · {clock(turn.atSec)} · turno {turn.turn}
                    </p>
                    <p>{turn.text}</p>
                  </article>
                ))}
              </div>
              {active && (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className={button}
                      disabled={!voiceAvailable || micPending || transcribing}
                      onClick={listen}
                    >
                      {listening
                        ? "Concluir fala"
                        : transcribing
                          ? "Transcrevendo…"
                          : "Falar com Maria"}
                    </button>
                    <button
                      className={button}
                      disabled={listening || micPending || transcribing}
                      onClick={() => {
                        const last = [...s.transcript]
                          .reverse()
                          .find((turn) => turn.role === "patient");
                        if (last) {
                          stopVoice();
                          void sayPatient(last, s.emotion);
                        }
                      }}
                    >
                      Ouvir novamente
                    </button>
                    <label className="text-sm">
                      <input
                        type="checkbox"
                        checked={voice}
                        onChange={(e) => {
                          setVoice(e.target.checked);
                          if (!e.target.checked) {
                            stopVoice();
                          }
                        }}
                      />{" "}
                      Ouvir Maria
                    </label>
                  </div>
                  {!voiceAvailable && (
                    <p className="text-sm">
                      Reconhecimento de voz indisponível neste navegador. Use o texto abaixo.
                    </p>
                  )}
                  <label className="block text-sm">
                    Sua fala / transcrição de voz
                    <textarea
                      className={`${field} mt-2`}
                      rows={3}
                      maxLength={4000}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={!input.trim() || listening}
                    onClick={() => send()}
                  >
                    Enviar fala
                  </button>
                  <details>
                    <summary>Registrar decisão ou solicitação adicional</summary>
                    <textarea
                      aria-label="Decisão ou solicitação clínica"
                      className={`${field} mt-2`}
                      maxLength={4000}
                      value={decision}
                      onChange={(e) => setDecision(e.target.value)}
                    />
                    <button
                      className={button}
                      disabled={!decision.trim()}
                      onClick={() => {
                        const value = current.current!;
                        commit({ ...value, session: recordDecision(value.session, decision) });
                        setDecision("");
                        setNotice(
                          "Registro incluído. Resultados adicionais não previstos no cenário estão indisponíveis.",
                        );
                      }}
                    >
                      Registrar
                    </button>
                  </details>
                  <button
                    className={button}
                    onClick={() => {
                      stopVoice();
                      const value = current.current!;
                      commit({ ...value, session: finish(value.session) });
                    }}
                  >
                    Encerrar consulta
                  </button>
                </>
              )}
            </section>
          </div>
          {s.mode === "reflection_mode" && (
            <section className={`${box} space-y-3`}>
              <h2 className="text-lg font-semibold">Autorreflexão</h2>
              <p>{PV001.reflection}</p>
              <textarea
                aria-label="Sua autorreflexão"
                className={field}
                value={reflection}
                maxLength={12000}
                onChange={(e) => setReflection(e.target.value)}
              />
              <button
                className={button}
                disabled={!reflection.trim()}
                onClick={() => {
                  const value = current.current!;
                  commit({ ...value, session: reflect(value.session, reflection) });
                }}
              >
                Registrar reflexão e iniciar debriefing
              </button>
            </section>
          )}
          {s.mode === "debriefing_mode" && (
            <section className={`${box} space-y-3`}>
              <h2 className="text-lg font-semibold">Debriefing formativo</h2>
              <p>Este espaço de reflexão é separado do checklist.</p>
              {s.debriefing.map((item) => (
                <div key={item.question}>
                  <p className="font-medium">{item.question}</p>
                  <p>{item.answer}</p>
                </div>
              ))}
              {s.debriefing.length < PV001.debrief.length ? (
                <>
                  <p>{PV001.debrief[s.debriefing.length]}</p>
                  <textarea
                    aria-label="Resposta ao debriefing"
                    className={field}
                    value={debrief}
                    maxLength={12000}
                    onChange={(e) => setDebrief(e.target.value)}
                  />
                  <button
                    className={button}
                    disabled={!debrief.trim()}
                    onClick={() => {
                      const value = current.current!;
                      const next = structuredClone(value);
                      const question = PV001.debrief[next.session.debriefing.length];
                      if (question) {
                        next.session.debriefing.push({ question, answer: debrief.trim() });
                        commit(next);
                        setDebrief("");
                      }
                    }}
                  >
                    Registrar e continuar
                  </button>
                </>
              ) : (
                <p>Debriefing registrado.</p>
              )}
            </section>
          )}
          {s.mode === "debriefing_mode" && (
            <details className={box}>
              <summary>Checklist separado — sugestão e revisão humana</summary>
              <div className="mt-4 space-y-3">
                <p>
                  NR: não realizado/não evidenciado; I: inadequado; PA: parcialmente adequado; A:
                  adequado. Nenhuma classificação é certificadora. A revisão abaixo é local e não
                  autentica a identidade do revisor.
                </p>
                <button className={button} disabled={busy} onClick={runEvaluation}>
                  {busy ? "Avaliando evidências…" : "Solicitar sugestão automatizada"}
                </button>
                <button
                  className={button}
                  onClick={() =>
                    setReviewItems(
                      CHECKLIST.map(([criterion]) => ({
                        criterion,
                        status: "NR",
                        evidence: [],
                        rationale: "Sem evidência suficiente.",
                      })),
                    )
                  }
                >
                  Iniciar revisão humana
                </button>
                {record?.evaluation && (
                  <div>
                    <p>
                      Sugestão automática:{" "}
                      {record.evaluation.source === "unavailable"
                        ? "indisponível"
                        : "aguarda revisão humana"}
                      .
                    </p>
                    {record.evaluation.items.map((j) => (
                      <p key={j.criterion} className="my-2 text-sm">
                        <strong>
                          {j.criterion}: {j.status}
                        </strong>{" "}
                        — {j.rationale}{" "}
                        {j.evidence.map((e) => `Turno ${e.turn}: “${e.student_text}”`).join(" ")}
                      </p>
                    ))}
                  </div>
                )}
                {reviewItems.map((j, i) => (
                  <div key={j.criterion} className="space-y-2 border-t border-line pt-3">
                    <p>{CHECKLIST.find(([id]) => id === j.criterion)?.[1]}</p>
                    <select
                      aria-label={`Status ${j.criterion}`}
                      className={field}
                      value={j.status}
                      onChange={(e) =>
                        setReviewItems((items) =>
                          items.map((item, index) =>
                            index === i ? { ...item, status: e.target.value as Status } : item,
                          ),
                        )
                      }
                    >
                      {["NR", "I", "PA", "A"].map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                    <label className="block text-sm">
                      Turnos que sustentam o julgamento (seleção múltipla)
                      <select
                        multiple
                        className={field}
                        value={j.evidence.map((e) => String(e.turn))}
                        onChange={(e) => {
                          const ids = Array.from(e.target.selectedOptions).map((o) =>
                            Number(o.value),
                          );
                          setReviewItems((items) =>
                            items.map((item, index) =>
                              index === i
                                ? {
                                    ...item,
                                    evidence: s.transcript
                                      .filter((t) => t.role === "student" && ids.includes(t.turn))
                                      .map((t) => ({ turn: t.turn, student_text: t.text })),
                                  }
                                : item,
                            ),
                          );
                        }}
                      >
                        {s.transcript
                          .filter((t) => t.role === "student")
                          .map((t) => (
                            <option key={t.turn} value={t.turn}>
                              {t.turn}: {t.text}
                            </option>
                          ))}
                      </select>
                    </label>
                    <textarea
                      aria-label={`Justificativa ${j.criterion}`}
                      className={field}
                      value={j.rationale}
                      onChange={(e) =>
                        setReviewItems((items) =>
                          items.map((item, index) =>
                            index === i ? { ...item, rationale: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                ))}
                {reviewItems.length > 0 && (
                  <>
                    <label className="block">
                      Código do revisor
                      <input
                        className={field}
                        value={reviewer}
                        onChange={(e) => setReviewer(e.target.value)}
                      />
                    </label>
                    <label className="block">
                      Nota da revisão
                      <textarea
                        className={field}
                        value={reviewNote}
                        onChange={(e) => setReviewNote(e.target.value)}
                      />
                    </label>
                    <button
                      className={button}
                      onClick={() => {
                        try {
                          const value = current.current!;
                          const review = validateReview(value.session, {
                            reviewer,
                            at: new Date().toISOString(),
                            items: reviewItems,
                            note: reviewNote,
                          });
                          commit({ ...value, reviews: [...value.reviews, review] });
                          setNotice("Revisão registrada sem sobrescrever a sugestão automática.");
                        } catch (e) {
                          setError((e as Error).message);
                        }
                      }}
                    >
                      Salvar revisão humana
                    </button>
                  </>
                )}
                <p>{record?.reviews.length ?? 0} revisões registradas.</p>
              </div>
            </details>
          )}
          <footer className="flex flex-wrap items-center gap-3">
            <button
              className={button}
              onClick={() => download(current.current, `PV-001-v1.1-${s.sessionId}.json`)}
            >
              Exportar sessão completa
            </button>
            <p className="text-xs">
              Salvamento local · versão e especificação preservadas na sessão
            </p>
          </footer>
        </>
      )}
    </main>
  );
}
