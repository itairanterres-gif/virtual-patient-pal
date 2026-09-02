import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { buildActorPrompt, emitirFala, type SpeakingActor } from "./theo-actors";

const AskTheoSchema = z.object({
  actor: z.enum(["theo", "mae"]),
  question: z.string().min(1).max(1000),
  transcript: z
    .array(z.object({ role: z.enum(["student", "actor"]), content: z.string().max(2000) }))
    .max(60)
    .default([]),
});

/**
 * O modelo apenas SELECIONA falas autorizadas; o servidor monta o texto.
 *
 * Não há campo de texto livre na saída do modelo: não existe caminho pelo qual
 * prosa clínica gerada por ele alcance o estudante. Fatos sensíveis não são
 * nem enviados no prompt sem pergunta direta compatível, e a liberação é
 * revalidada aqui na emissão.
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
          schema: z.object({
            selecoes: z.array(z.object({ factId: z.string(), verbalizacaoId: z.string() })),
          }),
        }),
        system: buildActorPrompt(actor, data.question),
        messages: [
          ...data.transcript.map((t) => ({
            role: (t.role === "student" ? "user" : "assistant") as "user" | "assistant",
            content: t.content,
          })),
          { role: "user" as const, content: data.question },
        ],
        temperature: 0.2,
      });

      const out = await result.output;
      const emissao = emitirFala(actor, out?.selecoes, data.question);
      return {
        reply: emissao.reply,
        factIds: emissao.factIds,
        verbalizacaoIds: emissao.verbalizacaoIds,
        grounded: emissao.ok,
        blockedReason: emissao.reason ?? null,
      };
    } catch {
      const emissao = emitirFala(actor, [{ verbalizacaoId: "inexistente" }], data.question);
      return {
        reply: emissao.reply,
        factIds: [],
        verbalizacaoIds: [],
        grounded: false,
        blockedReason: "falha de comunicação com o modelo",
      };
    }
  });
