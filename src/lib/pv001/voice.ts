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
export function speak(text: string, onError: () => void) {
  if (!("speechSynthesis" in window)) {
    onError();
    return;
  }
  window.speechSynthesis.cancel();
  const voices = window.speechSynthesis.getVoices();
  const voice =
    voices.find((v) => /^pt[-_]BR$/i.test(v.lang)) ?? voices.find((v) => /^pt/i.test(v.lang));
  const utterance = new SpeechSynthesisUtterance(text.replaceAll("Doutor(a)", "Doutor"));
  utterance.lang = "pt-BR";
  utterance.rate = 0.95;
  if (voice) utterance.voice = voice;
  utterance.onerror = (event) => {
    if (event.error !== "canceled" && event.error !== "interrupted") onError();
  };
  window.speechSynthesis.speak(utterance);
}
export function stopSpeech() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
