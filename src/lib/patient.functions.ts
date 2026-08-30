import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { getCase } from "./cases";
import { buildEvaluationPrompt, buildPatientPrompt, gatingNoteFor } from "./prompts";

const TurnSchema = z.object({
  role: z.enum(["student", "patient"]),
  content: z.string(),
});

const AskSchema = z.object({
  caseId: z.string(),
  question: z.string().min(1).max(1000),
  transcript: z.array(TurnSchema).max(80),
});

const EvaluateSchema = z.object({
  caseId: z.string(),
  transcript: z.array(TurnSchema).max(80),
});

export const askPatient = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AskSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Configuração de IA ausente (LOVABLE_API_KEY).");

    const clinicalCase = getCase(data.caseId);
    if (!clinicalCase) throw new Error("Caso não encontrado.");

    const studentTurns = data.transcript.filter((t) => t.role === "student").length;
    const gateway = createLovableAiGatewayProvider(apiKey);

    const result = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      system: buildPatientPrompt(clinicalCase, gatingNoteFor(studentTurns)),
      messages: [
        ...data.transcript.map((t) => ({
          role: (t.role === "student" ? "user" : "assistant") as "user" | "assistant",
          content: t.content,
        })),
        { role: "user" as const, content: data.question },
      ],
    });

    return { reply: await result.text };
  });

export const evaluateSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EvaluateSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Configuração de IA ausente (LOVABLE_API_KEY).");

    const clinicalCase = getCase(data.caseId);
    if (!clinicalCase) throw new Error("Caso não encontrado.");

    const domain = z.object({ nota: z.number().min(0).max(100), comentario: z.string() });
    const gateway = createLovableAiGatewayProvider(apiKey);

    const result = await generateText({
      model: gateway("google/gemini-3.7-flash"),
      output: Output.object({
        schema: z.object({
          rapport: domain,
          anamnese: domain,
          raciocinio: domain,
          diagnostico: domain,
          conduta: domain,
          resumo: z.string(),
        }),
      }),
      prompt: buildEvaluationPrompt(clinicalCase, data.transcript),
    });

    return await result.output;
  });
