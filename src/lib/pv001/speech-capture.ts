import type { Recognition } from "./voice";

export type SpeechCapture = { finish(): void; cancel(): void };
type Callbacks = {
  onDraft(text: string): void;
  onComplete(text: string): void;
  onError(error: string, draft: string): void;
  onLimit(draft: string): void;
};
const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ");

/** A browser endpoint may end on silence even in continuous mode. Only finish submits. */
export function captureSpeech(
  Constructor: new () => Recognition,
  callbacks: Callbacks,
): SpeechCapture {
  let current: Recognition | null = null;
  let prefix = "";
  let segment = "";
  let active = true;
  let finishing = false;
  let emptyRestarts = 0;
  let restart: ReturnType<typeof setTimeout> | undefined;
  let finishTimeout: ReturnType<typeof setTimeout> | undefined;
  const text = () => join(prefix, segment);
  const detach = () => {
    if (!current) return;
    const old = current;
    current = null;
    old.onresult = null;
    old.onerror = null;
    old.onend = null;
    old.abort();
  };
  const cancel = () => {
    active = false;
    clearTimeout(restart);
    clearTimeout(finishTimeout);
    clearTimeout(limit);
    detach();
  };
  const complete = () => {
    if (!active || !finishing) return;
    const draft = text();
    cancel();
    callbacks.onComplete(draft);
  };
  const fail = (error: string) => {
    if (!active) return;
    const draft = text();
    cancel();
    callbacks.onError(error, draft);
  };
  const start = () => {
    if (!active || finishing) return;
    const rec = new Constructor();
    current = rec;
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event) => {
      if (!active || current !== rec) return;
      // Results are cumulative within one recognition run. Rebuild, don't append duplicates.
      segment = Array.from(event.results)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(" ");
      callbacks.onDraft(text());
    };
    rec.onerror = (event) => {
      if (!active || current !== rec) return;
      // Silence ends this run; onend restarts it while the user still owns the turn.
      if (event.error !== "no-speech") fail(event.error);
    };
    rec.onend = () => {
      if (!active || current !== rec) return;
      current = null;
      if (finishing) {
        complete();
        return;
      }
      emptyRestarts = segment.trim() ? 0 : emptyRestarts + 1;
      prefix = text();
      segment = "";
      if (emptyRestarts >= 3) {
        fail("no-speech");
        return;
      }
      restart = setTimeout(start, 150);
    };
    try {
      rec.start();
    } catch (error) {
      fail(error instanceof Error ? error.name : "capture-error");
    }
  };
  const limit = setTimeout(() => {
    if (!active) return;
    const draft = text();
    cancel();
    callbacks.onLimit(draft);
  }, 120000);
  start();
  return {
    cancel,
    finish() {
      if (!active || finishing) return;
      finishing = true;
      clearTimeout(restart);
      clearTimeout(limit);
      if (!current) {
        complete();
        return;
      }
      // Keep receiving the final result after stop; fall back to the visible draft if needed.
      finishTimeout = setTimeout(complete, 1500);
      try {
        current.stop();
      } catch {
        complete();
      }
    },
  };
}
