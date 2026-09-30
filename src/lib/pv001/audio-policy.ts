import { z } from "zod";
import { LINES, type LineId } from "./case";
import { spokenText } from "./spoken-text";

export const speechInput = z.object({
  lineIds: z
    .array(z.custom<LineId>((id) => typeof id === "string" && Object.hasOwn(LINES, id)))
    .min(1)
    .max(12),
  emotion: z.enum(["anxious", "reassured", "collaborative", "withdrawn"]),
});
export function speechText(data: z.infer<typeof speechInput>) {
  return spokenText(data.lineIds.map((id) => LINES[id]).join(" "));
}
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
export function validateRecording(data: unknown): File {
  const file = data instanceof FormData ? data.get("audio") : null;
  if (
    !(file instanceof File) ||
    !file.size ||
    file.size > MAX_AUDIO_BYTES ||
    !/^audio\/(webm|mp4|ogg|wav|mpeg)(;.*)?$/.test(file.type)
  ) {
    throw new Error("Gravação inválida ou muito longa. Grave uma fala de até 45 segundos.");
  }
  return file;
}

// This optional, paid integration is a local pilot only. Production needs institutional auth.
export function localAudioEnabled(
  development: boolean,
  host: string,
  enabled?: string,
  key?: string,
) {
  return (
    development &&
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) &&
    enabled === "true" &&
    !!key
  );
}
