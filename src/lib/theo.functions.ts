import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { buildActorPrompt, validateActorReply, type SpeakingActor } from "./theo-actors";

const AskTheoSchema = z.object({
  actor: z.enum(["theo", "mae"]),
  question: z.string().min(1).max(1000),
  transcript: z
    .array(z.object({ role: z.enum(["student", "actor"]), content: z.string().max(2000) }))
    .max(60)
    .default([]),
});

/**
 * O modelo é APENAS a voz de Théo ou da mãe.
 * Recebe somente os fatos daquele ator; a resposta é validada em conteúdo e IDs
 * antes de voltar ao motor. Nenhum dado objetivo, diagnóstico ou consequência
 * futura é enviado ao modelo.
 */
export const askTheoActor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskTheoSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Configuração de IA ausente (LOVABLE_API_KEY).");
    const actor = data.actor as SpeakingActor;
    const gateway = createLovableAiGatewayProvider(apiKey);

    try {
      const result = await generateText({
        model: gateway("google/gemini-3.7-flash"),
        output: Output.object({
          schema: z.object({ reply: z.string(), factIds: z.array(z.string()) }),
        }),
        system: buildActorPrompt(actor),
        messages: [
          ...data.transcript.map((t) => ({
            role: (t.role === "student" ? "user" : "assistant") as "user" | "assistant",
            content: t.content,
          })),
          { role: "user" as const, content: data.question },
        ],
        temperature: 0.6,
      });

      const out = result.experimental_output;
      const check = validateActorReply(actor, out?.reply ?? "", out?.factIds ?? []);
      return {
        reply: check.reply,
        factIds: check.factIds,
        grounded: check.ok,
        blockedReason: check.ok ? null : check.reason,
      };
    } catch {
      const check = validateActorReply(actor, "", []);
      return {
        reply: check.reply,
        factIds: [],
        grounded: false,
        blockedReason: "falha de comunicação com o modelo",
      };
    }
  });
