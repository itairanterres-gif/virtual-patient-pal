import { describe, expect, it } from "vitest";
import { LINES, type LineId } from "../pv001/case";
import { createSession, respond, type Session } from "../pv001/engine";
import {
  ACTOR_SYSTEM_PROMPT,
  actorConfig,
  actorRequestOf,
  buildActorPrompt,
  perform,
  performable,
  performWithModel,
  verifyPerformance,
} from "../pv001/actor";
import type { Generate } from "../pv001/intent";

const start = 1800000000000;
const make = () => createSession("piloto-01", "synthetic-actor", start);
const at = (s: Session) => start + (s.elapsedSec + 10) * 1000;
const check = (
  text: string,
  beats: LineId[],
  studentText = "",
  delivered: LineId[] = ["opening"],
) => verifyPerformance({ text, beats, delivered, studentText });

// All texts below are hand-written test fixtures, not model output.
describe("PV-001 actor — performance gate", () => {
  it("accepts every exact script line, so the fallback itself always passes", () => {
    for (const id of Object.keys(LINES) as LineId[]) {
      if (id === "opening") continue;
      expect(check(LINES[id], [id]), id).toMatchObject({ ok: true });
    }
  });

  it("accepts natural paraphrases that keep the beat and the facts", () => {
    expect(
      check("Mas eu já tomo remédio pra diabetes... por que mais um outro?", ["why"]),
    ).toMatchObject({ ok: true });
    expect(
      check(
        "Tomo a metformina de mil, de doze em doze horas, e a losartana de cinquenta, também de doze em doze horas.",
        ["medications"],
        "Quais remédios a senhora usa?",
      ),
    ).toMatchObject({ ok: true });
    expect(
      check(
        "Bom dia. Ah, tô meio nervosa com esse negócio do rim, sabe?",
        ["unknown"],
        "Bom dia, como a senhora está?",
      ),
    ).toMatchObject({ ok: true });
    expect(
      check("Alergia? Isso eu não sei dizer.", ["unknown"], "A senhora tem alergia?"),
    ).toMatchObject({ ok: true });
    expect(
      check("Não, dor no peito eu não tenho.", ["chest"], "Sente dor no peito?"),
    ).toMatchObject({ ok: true });
    expect(
      check(
        "Ah, então esse remédio cuida do coração também, não é só pelo açúcar.",
        ["cardio"],
        "Ele protege o coração e os rins, não é só para o açúcar.",
        ["opening", "why"],
      ),
    ).toMatchObject({ ok: true });
  });

  it("rejects invented clinical facts, numbers and adherence claims", () => {
    const rejected = [
      check("Tenho alergia a dipirona.", ["unknown"], "A senhora tem alergia?"),
      check("Não, nunca tive alergia.", ["unknown"], "A senhora tem alergia?"),
      check(
        "Tomo metformina 1000, duas vezes ao dia, e losartana 50.",
        ["medications"],
        "Que remédios usa?",
      ),
      check("Tenho 62 anos.", ["identity"], "Qual sua idade?"),
      check("Estou ouvindo. Eu tomo meus remédios certinho, viu?", ["listening"]),
      check("Estou ouvindo. Minha glicada deu oito.", ["listening"]),
      check("Tenho dor no peito às vezes.", ["chest"], "Sente dor no peito?"),
      check("Ah, então é pro coração, não é só pelo açúcar.", ["cardio"], "Não é só pelo açúcar."),
      check("Às vezes sinto falta de ar quando subo escada.", ["unknown"], "Como a senhora está?"),
      check(
        "Fico mais tranquila com essa explicação. Mas vou acabar fazendo diálise?",
        ["reassured"],
        "Ficou alguma dúvida?",
      ),
    ];
    for (const r of rejected) expect(r.ok, JSON.stringify(r)).toBe(false);
  });

  it("rejects missing beats, teaching, meta talk and gendered address", () => {
    for (const r of [
      check("Tá bom.", ["access"]),
      check("Entendi.", ["why"]),
      check("Esse remédio é um iSGLT2 que protege os rins pela diretriz.", ["renalBenefit"]),
      check("Como sou uma IA, não posso responder.", ["unknown"]),
      check("Estou ouvindo, doutora.", ["listening"]),
      check("**Maria:** Estou ouvindo.", ["listening"]),
      check("x".repeat(500), ["listening"]),
      verifyPerformance({ text: 42, beats: ["listening"], delivered: [], studentText: "" }),
    ])
      expect(r.ok, JSON.stringify(r)).toBe(false);
  });
});

describe("PV-001 actor — applying and falling back", () => {
  const withWhy = () => respond(make(), "Vamos adicionar outro remédio.", start + 10000);

  it("replaces only the displayed text, keeps the script and records the voice", () => {
    const s = withWhy();
    const turn = s.transcript.at(-1)!;
    expect(performable(turn)).toBe(true);
    const out = perform(s, turn.turn, {
      source: "actor",
      text: "Mas eu já tomo remédio pra diabetes. Por que outro?",
      model: "fake",
    });
    const t = out.transcript.at(-1)!;
    expect(t.text).toBe("Mas eu já tomo remédio pra diabetes. Por que outro?");
    expect(t.performance).toEqual({ by: "actor", model: "fake", script: LINES.why });
    expect(t.lineIds).toEqual(["why"]);
    expect(out.technicalEvents.at(-1)).toMatchObject({
      type: "patient_voice",
      detail: "actor:fake",
    });
    // Applied once only.
    expect(
      perform(out, turn.turn, { source: "actor", text: "Por que outro remédio?", model: "x" }),
    ).toBe(out);
  });

  it("keeps the script line when the performance is rejected or unavailable", () => {
    const s = withWhy();
    const turn = s.transcript.at(-1)!;
    const bad = perform(s, turn.turn, {
      source: "actor",
      text: "Por que outro? Minha creatinina é 2.",
      model: "fake",
    });
    expect(bad.transcript.at(-1)!.text).toBe(LINES.why);
    expect(bad.transcript.at(-1)!.performance).toMatchObject({ by: "script" });
    const off = perform(s, turn.turn, { source: "script", reason: "disabled" });
    expect(off.transcript.at(-1)!.text).toBe(LINES.why);
    expect(off.technicalEvents.at(-1)).toMatchObject({ detail: "script:disabled" });
  });

  it("never performs the opening", () => {
    expect(performable(make().transcript[0]!)).toBe(false);
  });

  it("the engine still decides the beats: a full conversation keeps its state machine", () => {
    let s = make();
    for (const text of [
      "Entendo seu medo. O rim ainda funciona; isso não significa diálise agora.",
      "Vamos adicionar outro remédio.",
      "Ele protege os rins e o coração, não é só para o açúcar.",
    ]) {
      s = respond(s, text, at(s));
      const last = s.transcript.at(-1)!;
      // A fake actor that repeats the script: must always pass and never change state.
      s = perform(s, last.turn, { source: "actor", text: last.text, model: "eco" });
    }
    expect(s.emotion).toBe("collaborative");
    expect(s.flags.costAsked).toBe(true);
    for (const t of s.transcript.filter(
      (x) => x.role === "patient" && x.performance?.by === "actor",
    ))
      expect(t.performance!.by === "actor" && t.performance!.script).toBe(
        t.lineIds.map((id) => LINES[id]).join(" "),
      );
  });

  it("model call falls back on timeout, error and invalid output", async () => {
    const s = withWhy();
    const req = actorRequestOf(s, s.transcript.at(-1)!);
    const hang: Generate = () =>
      new Promise((r) => setTimeout(() => r("Por que outro remédio?"), 1000));
    expect(await performWithModel(req, { generate: hang, model: "x", timeoutMs: 20 })).toEqual({
      source: "script",
      reason: "timeout",
    });
    const fail: Generate = async () => {
      throw new Error("401");
    };
    expect(await performWithModel(req, { generate: fail, model: "x" })).toEqual({
      source: "script",
      reason: "error",
    });
    const invent: Generate = async () =>
      "Por que outro remédio? Meu médico disse que minha TFG é 30.";
    expect((await performWithModel(req, { generate: invent, model: "x" })).source).toBe("script");
    const ok: Generate = async () => "Mas eu já tomo remédio pra diabetes. Por que outro?";
    expect(await performWithModel(req, { generate: ok, model: "x" })).toMatchObject({
      source: "actor",
    });
  });

  it("is off by default and sends the model no answer key", () => {
    expect(actorConfig({})).toEqual({ enabled: false, reason: "disabled" });
    expect(actorConfig({ PV001_LLM_ACTOR: "true" })).toEqual({ enabled: false, reason: "no_key" });
    const s = withWhy();
    const prompt = ACTOR_SYSTEM_PROMPT + buildActorPrompt(actorRequestOf(s, s.transcript.at(-1)!));
    for (const secret of [
      "CEAF",
      "PCDT",
      "iSGLT2",
      "<70",
      "alto risco",
      "estatina",
      "TFGe 49",
      "RAC",
    ])
      expect(prompt).not.toContain(secret);
    // Only released facts: medications not yet asked, so not in the prompt.
    expect(prompt).not.toContain("metformina");
  });
});
