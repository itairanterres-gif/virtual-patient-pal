import { spokenText } from "./spoken-text";

type ResultEvent = { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> };
export type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function recognitionConstructor() {
  const w = window as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
export function availableVoices() {
  if (!("speechSynthesis" in window)) return [];
  return window.speechSynthesis
    .getVoices()
    .filter((v) => /^pt/i.test(v.lang))
    .sort(
      (a, b) =>
        Number(/natural|online|neural/i.test(b.name)) -
        Number(/natural|online|neural/i.test(a.name)),
    );
}
export function speak(text: string, onError: () => void, voiceURI?: string) {
  if (!("speechSynthesis" in window)) {
    onError();
    return;
  }
  window.speechSynthesis.cancel();
  const voices = availableVoices();
  const voice =
    voices.find((v) => v.voiceURI === voiceURI) ??
    voices.find(
      (v) => /^pt[-_]BR$/i.test(v.lang) && /francisca|thalita|maria|luciana|female/i.test(v.name),
    ) ??
    voices.find((v) => /^pt[-_]BR$/i.test(v.lang)) ??
    voices[0];
  const utterance = new SpeechSynthesisUtterance(spokenText(text));
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  if (voice) utterance.voice = voice;
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") onError();
  };
  window.speechSynthesis.speak(utterance);
}
let player: HTMLAudioElement | null = null;
export async function playNaturalSpeech(base64: string) {
  stopSpeech();
  player = new Audio(`data:audio/mpeg;base64,${base64}`);
  await player.play();
}
export function stopSpeech() {
  player?.pause();
  player = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

export function microphoneMessage(error: unknown) {
  const name = typeof error === "string" ? error : error instanceof Error ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
    case "not-allowed":
    case "service-not-allowed":
      return "Microfone bloqueado. Nas permissões deste site, permita o microfone e tente novamente. Se estiver no navegador interno, abra o mesmo endereço no Edge ou Chrome. Confira também a permissão de microfone nas configurações do Windows.";
    case "NotFoundError":
    case "audio-capture":
      return "Nenhum microfone disponível. Conecte um microfone e confira o dispositivo de entrada do computador.";
    case "NotReadableError":
      return "O microfone está ocupado ou indisponível. Feche outros aplicativos que o utilizam e tente novamente.";
    case "network":
      return "Falha no serviço de reconhecimento de fala deste navegador. Isso não confirma defeito no microfone. Abra a consulta no Chrome externo ou use Windows + H no campo de texto. A transcrição alternativa da aplicação ainda depende de configuração.";
    case "no-speech":
      return "Nenhuma fala foi reconhecida. Confira o volume do microfone e tente novamente.";
    default:
      return "Não foi possível iniciar a voz. Tente novamente ou use o campo de texto.";
  }
}
export async function openMicrophone() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
    video: false,
  });
}
export type Recording = { stop(): void; cancel(): void; result: Promise<Blob | null> };
export function recordMicrophone(stream: MediaStream): Recording {
  const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find(
    (v) => MediaRecorder.isTypeSupported(v),
  );
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  } catch (error) {
    stream.getTracks().forEach((t) => t.stop());
    throw error;
  }
  const chunks: Blob[] = [];
  let canceled = false;
  let bytes = 0;
  const limit = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, 45000);
  const cleanup = () => {
    clearTimeout(limit);
    stream.getTracks().forEach((t) => t.stop());
  };
  const result = new Promise<Blob | null>((resolve, reject) => {
    recorder.ondataavailable = (event) => {
      bytes += event.data.size;
      if (bytes > 2 * 1024 * 1024) {
        canceled = true;
        if (recorder.state !== "inactive") recorder.stop();
      } else if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("Gravação interrompida"));
    };
    recorder.onstop = () => {
      cleanup();
      resolve(canceled ? null : new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  try {
    recorder.start(500);
  } catch (error) {
    cleanup();
    throw error;
  }
  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  return {
    stop,
    cancel: () => {
      canceled = true;
      stop();
      cleanup();
    },
    result,
  };
}
