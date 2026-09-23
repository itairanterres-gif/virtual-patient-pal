import { afterEach, expect, it, vi } from "vitest";
import {
  localAudioEnabled,
  speechInput,
  speechText,
  validateRecording,
} from "../pv001/audio-policy";
import { renderSpeech, transcribe } from "../pv001/audio.server";
import { microphoneMessage, recordMicrophone } from "../pv001/voice";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it("rejects unknown clinical speech and joins only the fixed patient vocabulary", () => {
  expect(() =>
    speechInput.parse({ lineIds: ["invented-diagnosis"], emotion: "anxious" }),
  ).toThrow();
  expect(() => speechInput.parse({ lineIds: ["toString"], emotion: "anxious" })).toThrow();
  expect(
    speechText(
      speechInput.parse({ lineIds: ["why", "cardio"], emotion: "reassured", text: "Injected" }),
    ),
  ).toBe("Mas eu já tomo remédio para diabetes. Por que outro? Ah, então não é só pelo açúcar.");
});
it("keeps paid pilot endpoints off in production, LAN and without explicit configuration", () => {
  expect(localAudioEnabled(true, "127.0.0.1:4173", "true", "test")).toBe(true);
  for (const host of ["192.168.5.191:4174", "localhost.evil.test", "example.com"])
    expect(localAudioEnabled(true, host, "true", "test")).toBe(false);
  expect(localAudioEnabled(false, "localhost:4173", "true", "test")).toBe(false);
  expect(localAudioEnabled(true, "localhost:4173", undefined, "test")).toBe(false);
  expect(localAudioEnabled(true, "localhost:4173", "true", undefined)).toBe(false);
});
it("rejects empty, oversized and nonaudio uploads", () => {
  for (const file of [
    new File([], "empty.webm", { type: "audio/webm" }),
    new File([new Uint8Array(2097153)], "big.webm", { type: "audio/webm" }),
    new File(["x"], "text", { type: "text/plain" }),
  ]) {
    const form = new FormData();
    form.set("audio", file);
    expect(() => validateRecording(form)).toThrow();
  }
  const form = new FormData();
  form.set("audio", new File(["audio"], "a.mp4", { type: "audio/mp4" }));
  expect(validateRecording(form).size).toBe(5);
});
it("requests fixed speech with emotional direction and caches it", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetcher);
  const data = speechInput.parse({ lineIds: ["identity"], emotion: "anxious" });
  expect(await renderSpeech(data)).toBe("AQID");
  expect(await renderSpeech(data)).toBe("AQID");
  expect(fetcher).toHaveBeenCalledTimes(1);
  const request = JSON.parse(fetcher.mock.calls[0]![1].body);
  expect(request.input).toBe("Sou Maria Aparecida Souza, tenho 61 anos.");
  expect(request.instructions).toContain("preocupação contida");
});
it("transcribes without priming the student's clinical answer", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ text: " Bom dia, Maria. " }));
  vi.stubGlobal("fetch", fetcher);
  expect(await transcribe(new File(["audio"], "a.mp4", { type: "audio/mp4" }))).toBe(
    "Bom dia, Maria.",
  );
  const body = fetcher.mock.calls[0]![1].body as FormData;
  expect(body.get("language")).toBe("pt");
  expect(body.has("prompt")).toBe(false);
  expect((body.get("file") as File).name).toBe("fala.mp4");
});
it("does not expose provider error bodies", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("sensitive account details", { status: 401 })),
  );
  await expect(transcribe(new File(["a"], "a.webm", { type: "audio/webm" }))).rejects.toThrow(
    "Serviço de áudio indisponível",
  );
});
it("releases microphone tracks and discards cancelled recordings", async () => {
  class Recorder {
    static isTypeSupported() {
      return true;
    }
    state = "inactive";
    mimeType = "audio/webm";
    onstop?: () => void;
    start() {
      this.state = "recording";
    }
    stop() {
      this.state = "inactive";
      this.onstop?.();
    }
  }
  vi.stubGlobal("MediaRecorder", Recorder);
  const stop = vi.fn();
  const capture = recordMicrophone({ getTracks: () => [{ stop }] } as unknown as MediaStream);
  capture.cancel();
  expect(await capture.result).toBeNull();
  expect(stop).toHaveBeenCalled();
});
it("gives actionable and distinct permission, device and network messages", () => {
  expect(microphoneMessage(new DOMException("Denied", "NotAllowedError"))).toContain("permissões");
  expect(microphoneMessage("audio-capture")).toContain("Nenhum microfone");
  expect(microphoneMessage("network")).toContain("internet");
});
