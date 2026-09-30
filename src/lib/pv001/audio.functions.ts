import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { localAudioEnabled, speechInput, validateRecording } from "./audio-policy";

function enabled() {
  return localAudioEnabled(
    import.meta.env.DEV,
    getRequestHeader("host") ?? "",
    process.env["PV001_AUDIO_ENABLED"],
    process.env["OPENAI_API_KEY"],
  );
}
export const audioCapabilities = createServerFn({ method: "GET" }).handler(() => ({
  natural: enabled(),
}));
export const renderMariaSpeech = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => speechInput.parse(data))
  .handler(async ({ data }) => {
    if (!enabled()) throw new Error("Voz natural ainda não configurada nesta prévia.");
    const { renderSpeech } = await import("./audio.server");
    return renderSpeech(data);
  });
export const transcribeStudent = createServerFn({ method: "POST" })
  .inputValidator((data: FormData) => {
    validateRecording(data);
    return data;
  })
  .handler(async ({ data }) => {
    if (!enabled()) throw new Error("Transcrição de áudio ainda não configurada nesta prévia.");
    const { transcribe } = await import("./audio.server");
    return transcribe(validateRecording(data));
  });
