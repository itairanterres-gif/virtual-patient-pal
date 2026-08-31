import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { getEngineCase } from "./engine-registry";
import { scoreSession, type ClinicalEvent, type DomainScore } from "./engine";
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

const EventSchema = z.object({
  id: z.string(),
  atSec: z.number(),
  clock: z.string(),
  kind: z.enum([
    "pergunta",
    "resposta",
    "exame_fisico",
    "exame_solicitado",
    "resultado",
    "hipotese",
    "conduta",
    "estado",
  ]),
  label: z.string(),
  detail: z.string().optional(),
  refId: z.string().optional(),
  status: z.enum(["normal", "warn", "crit"]),
});

const EvaluateSchema = z.object({
  caseId: z.string(),
  events: z.array(EventSchema).max(400),
  studentQuestions: z.array(z.string()).max(200),
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

export type SessionFeedback = {
  scores: DomainScore[];
  comentarios: Record<string, string>;
  resumo: string;
  melhorias: string[];
};

export const evaluateSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EvaluateSchema.parse(input))
  .handler(async ({ data }) => {
    const engineCase = getEngineCase(data.caseId);
    if (!engineCase) throw new Error("Caso não encontrado.");

    // Notas 100% determinísticas — derivadas do event log, nunca do LLM.
    const scores = scoreSession(engineCase, {
      events: data.events as ClinicalEvent[],
      studentQuestions: data.studentQuestions,
    });

    const timeline = data.events.map((e) => `${e.clock} · ${e.kind}: ${e.label}${e.detail ? ` — ${e.detail}` : ""}`);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return {
        scores,
        comentarios: {},
        resumo: "Devolutiva narrativa indisponível; placar objetivo calculado pelo simulador.",
        melhorias: [],
      } satisfies SessionFeedback;
    }

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
        prompt: buildFeedbackPrompt(engineCase, scores, timeline),
      });
      const out = await result.output;
      return {
        scores,
        comentarios: {
          rapport: out.rapport,
          anamnese: out.anamnese,
          raciocinio: out.raciocinio,
          diagnostico: out.diagnostico,
          conduta: out.conduta,
          seguranca: out.seguranca,
        },
        resumo: out.resumo,
        melhorias: out.melhorias,
      } satisfies SessionFeedback;
    } catch {
      return {
        scores,
        comentarios: {},
        resumo: "Não foi possível gerar a devolutiva narrativa; o placar objetivo permanece válido.",
        melhorias: [],
      } satisfies SessionFeedback;
    }
  });
