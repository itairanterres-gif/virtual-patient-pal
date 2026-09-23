import type { z } from "zod";
import { speechInput, speechText } from "./audio-policy";

const cache = new Map<string, string>();
let windowStart = Date.now();
let calls = 0;
function budget() {
  if (Date.now() - windowStart > 3600000) {
    windowStart = Date.now();
    calls = 0;
  }
  if (++calls > 240) throw new Error("Limite de áudio desta prévia atingido. Tente mais tarde.");
}
async function request(path: string, body: BodyInit, json = false) {
  budget();
  const response = await fetch(`https://api.openai.com/v1/audio/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env["OPENAI_API_KEY"]}`,
      ...(json ? { "Content-Type": "application/json" } : {}),
    },
    body,
    signal: AbortSignal.timeout(30000),
  });
  // Never return provider bodies, account details, credentials or supplied recordings in errors.
  if (!response.ok)
    throw new Error("Serviço de áudio indisponível. A transcrição em texto continua disponível.");
  return response;
}
export async function renderSpeech(data: z.infer<typeof speechInput>) {
  const key = JSON.stringify(data);
  const cached = cache.get(key);
  if (cached) return cached;
  const mood = {
    anxious: "preocupação contida, sem choro",
    reassured: "alívio discreto",
    collaborative: "atenção e confiança gradual",
    withdrawn: "hesitação e fala reservada",
  }[data.emotion];
  const response = await request(
    "speech",
    JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      response_format: "mp3",
      input: speechText(data),
      instructions: `Fale somente o texto fornecido, em português brasileiro. Voz de uma mulher adulta de 61 anos, conversa cotidiana em consulta, com ${mood}. Ritmo natural, pausas breves, sem locução publicitária ou caricatura. Não adicione palavras ou explicações.`,
    }),
    true,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 2 * 1024 * 1024) throw new Error("Áudio de resposta excedeu o limite.");
  const audio = Buffer.from(bytes).toString("base64");
  // Bound the process-local cache. It contains only fixed fictional patient lines.
  if (cache.size >= 40) cache.delete(cache.keys().next().value!);
  cache.set(key, audio);
  return audio;
}
export async function transcribe(file: File) {
  const form = new FormData();
  const extension = file.type.includes("mp4") ? "mp4" : file.type.includes("ogg") ? "ogg" : "webm";
  form.append("file", file, `fala.${extension}`);
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  // No clinical answer, expected vocabulary or transcript is supplied: avoid priming performance.
  const response = await request("transcriptions", form);
  const result = (await response.json()) as { text?: unknown };
  if (typeof result.text !== "string" || result.text.length > 4000)
    throw new Error("Não foi possível transcrever esta fala.");
  return result.text.trim();
}
