import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { getEngineCase } from "./engine-registry";
import { buildFeedbackPrompt, buildPatientPrompt } from "./prompts";

const TurnSchema = z.object({
  role: z.enum(["student", "patient"]),
  content: z.string(),
});

const AskSchema = z.object({
  caseId: z.string(),
  question: z.string().min(1).max(1000),
  transcript: z.array(TurnSchema).max(80),
  revealedFactIds: z.array(z.string()).max(200).default([]),
});

const ScoreSchema = z.object({
  domain: z.string(),
  label: z.string(),
  score: z.number(),
  met: z.array(z.string()),
  missed: z.array(z.string()),
});

const FeedbackSchema = z.object({
  caseId: z.string(),
  scores: z.array(ScoreSchema).max(20),
  timeline: z.array(z.string()).max(400),
});

export const askPatient = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Configuração de IA ausente (LOVABLE_API_KEY).");

    const engineCase = getEngineCase(data.caseId);
    if (!engineCase) throw new Error("Caso não encontrado.");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const validIds = new Set(
      engineCase.patientTruth.facts.filter((f) => f.patientKnows).map((f) => f.id),
    );

    const result = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      output: Output.object({
        schema: z.object({
          reply: z.string(),
          revealedFactIds: z.array(z.string()),
        }),
      }),
      system: buildPatientPrompt(engineCase, data.revealedFactIds),
      messages: [
        ...data.transcript.map((t) => ({
          role: (t.role === "student" ? "user" : "assistant") as "user" | "assistant",
          content: t.content,
        })),
        { role: "user" as const, content: data.question },
      ],
    });

    const output = await result.output;
    return {
      reply: output.reply,
      revealedFactIds: output.revealedFactIds.filter((id) => validIds.has(id)),
    };
  });

/**
 * A IA só escreve a devolutiva narrativa: as notas chegam prontas do motor
 * determinístico (calculadas a partir do event log da sessão).
 */
export const narrateFeedback = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FeedbackSchema.parse(input))
  .handler(async ({ data }) => {
    const engineCase = getEngineCase(data.caseId);
    if (!engineCase) throw new Error("Caso não encontrado.");

    const empty = {
      comentarios: {} as Record<string, string>,
      resumo: "Devolutiva narrativa indisponível; o placar objetivo do simulador permanece válido.",
      melhorias: [] as string[],
    };

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return empty;

    const gateway = createLovableAiGatewayProvider(apiKey);
    try {
      const result = await generateText({
        model: gateway("google/gemini-3.7-flash"),
        output: Output.object({
          schema: z.object({
            rapport: z.string(),
            anamnese: z.string(),
            raciocinio: z.string(),
            diagnostico: z.string(),
            conduta: z.string(),
            seguranca: z.string(),
            resumo: z.string(),
            melhorias: z.array(z.string()),
          }),
        }),
        prompt: buildFeedbackPrompt(engineCase, data.scores, data.timeline),
      });
      const out = await result.output;
      return {
        comentarios: {
          rapport: out.rapport,
          anamnese: out.anamnese,
          raciocinio: out.raciocinio,
          diagnostico: out.diagnostico,
          conduta: out.conduta,
          seguranca: out.seguranca,
        } as Record<string, string>,
        resumo: out.resumo,
        melhorias: out.melhorias,
      };
    } catch {
      return empty;
    }
  });
