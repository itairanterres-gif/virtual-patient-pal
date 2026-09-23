import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { captureSpeech } from "../pv001/speech-capture";
import type { Recognition } from "../pv001/voice";

class BrowserRecognition implements Recognition {
  static instances: BrowserRecognition[] = [];
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: Recognition["onresult"] = null;
  onerror: Recognition["onerror"] = null;
  onend: Recognition["onend"] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  constructor() {
    BrowserRecognition.instances.push(this);
  }
  results(...phrases: string[]) {
    this.onresult?.({
      results: phrases.map((transcript) => ({ isFinal: true, 0: { transcript } })),
    });
  }
}
const callbacks = () => ({
  onDraft: vi.fn(),
  onComplete: vi.fn(),
  onError: vi.fn(),
  onLimit: vi.fn(),
});
beforeEach(() => {
  vi.useFakeTimers();
  BrowserRecognition.instances = [];
});
afterEach(() => vi.useRealTimers());

it("keeps pauses within a single student turn and sends accumulated speech only on finish", () => {
  const events = callbacks();
  const control = captureSpeech(BrowserRecognition, events);
  const first = BrowserRecognition.instances[0]!;
  expect(first.continuous).toBe(true);
  first.results("O exame do rim tem uma alteração.");
  first.onend?.();
  expect(events.onComplete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(150);
  const second = BrowserRecognition.instances[1]!;
  second.results("Vamos conversar", "sobre como cuidar dos rins.");
  second.results("Vamos conversar", "sobre como cuidar dos rins e do coração.");
  control.finish();
  expect(second.stop).toHaveBeenCalledOnce();
  second.onend?.();
  expect(events.onComplete).toHaveBeenCalledExactlyOnceWith(
    "O exame do rim tem uma alteração. Vamos conversar sobre como cuidar dos rins e do coração.",
  );
  control.finish();
  vi.runAllTimers();
  expect(events.onComplete).toHaveBeenCalledTimes(1);
});
it("can finish during a pause without losing the previous phrase", () => {
  const events = callbacks();
  const control = captureSpeech(BrowserRecognition, events);
  const rec = BrowserRecognition.instances[0]!;
  rec.results("Entendo sua preocupação.");
  rec.onend?.();
  control.finish();
  vi.runAllTimers();
  expect(BrowserRecognition.instances).toHaveLength(1);
  expect(events.onComplete).toHaveBeenCalledExactlyOnceWith("Entendo sua preocupação.");
});
it("discards late callbacks and restarts after cancellation or encounter closure", () => {
  const events = callbacks();
  const control = captureSpeech(BrowserRecognition, events);
  const rec = BrowserRecognition.instances[0]!;
  const lateResult = rec.onresult;
  const lateEnd = rec.onend;
  control.cancel();
  lateResult?.({ results: [{ isFinal: true, 0: { transcript: "Late" } }] });
  lateEnd?.();
  vi.runAllTimers();
  expect(events.onComplete).not.toHaveBeenCalled();
  expect(events.onDraft).not.toHaveBeenCalled();
  expect(BrowserRecognition.instances).toHaveLength(1);
});
it("preserves captured speech on a network failure without sending it", () => {
  const events = callbacks();
  captureSpeech(BrowserRecognition, events);
  const rec = BrowserRecognition.instances[0]!;
  rec.results("Vamos conversar.");
  rec.onerror?.({ error: "network" });
  vi.runAllTimers();
  expect(events.onError).toHaveBeenCalledExactlyOnceWith("network", "Vamos conversar.");
  expect(events.onComplete).not.toHaveBeenCalled();
});
it("preserves the draft at the two-minute limit without sending it", () => {
  const events = callbacks();
  captureSpeech(BrowserRecognition, events);
  BrowserRecognition.instances[0]!.results("Plano ainda em elaboração.");
  vi.advanceTimersByTime(120000);
  expect(events.onLimit).toHaveBeenCalledExactlyOnceWith("Plano ainda em elaboração.");
  expect(events.onComplete).not.toHaveBeenCalled();
});
it("bounds retries after repeated silence and retains the text when stop never emits end", () => {
  const events = callbacks();
  captureSpeech(BrowserRecognition, events);
  for (let i = 0; i < 3; i++) {
    BrowserRecognition.instances[i]!.onend?.();
    vi.advanceTimersByTime(150);
  }
  expect(events.onError).toHaveBeenCalledExactlyOnceWith("no-speech", "");
  const secondEvents = callbacks();
  const control = captureSpeech(BrowserRecognition, secondEvents);
  BrowserRecognition.instances[3]!.results("Uma frase completa.");
  control.finish();
  vi.advanceTimersByTime(1500);
  expect(secondEvents.onComplete).toHaveBeenCalledExactlyOnceWith("Uma frase completa.");
});
