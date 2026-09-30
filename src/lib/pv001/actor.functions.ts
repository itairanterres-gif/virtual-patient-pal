import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { LINES, type LineId } from "./case";
import { actorConfig, performWithModel, type ActorResult } from "./actor";

const lineId = z.enum(Object.keys(LINES) as [LineId, ...LineId[]]);
const actorInput = z
  .object({
    beats: z.array(lineId).min(1).max(8),
    delivered: z.array(lineId).max(40),
    emotion: z.enum(["anxious", "reassured", "collaborative", "withdrawn"]),
    studentText: z.string().max(4000),
    recent: z
      .array(z.object({ role: z.enum(["student", "patient"]), text: z.string().max(4000) }))
      .max(6),
    pending: z.array(z.enum(["medo_do_rim", "custo_do_remedio"])).max(2),
  })
  .strict();

export const actorCapabilities = createServerFn({ method: "GET" }).handler(() => ({
  enabled: actorConfig(process.env).enabled,
}));

/**
 * Natural performance of the beats chosen by the engine. Facts come from LINES on the server,
 * never from the client; the result is verified here and again when applied.
 */
export const performMaria = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => actorInput.parse(data))
  .handler(async ({ data }): Promise<ActorResult> => {
    const cfg = actorConfig(process.env);
    if (!cfg.enabled) return { source: "script", reason: cfg.reason };
    try {
      const { intentGenerator, withinBudget } = await import("./intent-provider.server");
      if (!withinBudget()) return { source: "script", reason: "budget" };
      return await performWithModel(data, {
        generate: intentGenerator(cfg, 0.7),
        model: cfg.model,
      });
    } catch {
      return { source: "script", reason: "error" };
    }
  });
