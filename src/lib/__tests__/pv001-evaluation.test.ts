import { describe, it, expect } from "vitest";
import { createSession, respond, finish } from "../pv001/engine";
import { CHECKLIST, validateEvaluation, validateReview, type Judgment } from "../pv001/evaluator";
import { loadRecord, saveRecord, STORAGE_PREFIX, type RecordEnvelope } from "../pv001/persistence";
const start = 1800000000000;
const consultation = () =>
  finish(
    respond(
      createSession("aluno", "sessao", start),
      "Entendo seu medo. Isso não significa precisar de diálise agora.",
      start + 1000,
    ),
    start + 2000,
  );
const empty = (): Judgment[] =>
  CHECKLIST.map(([criterion]) => ({
    criterion,
    status: "NR",
    evidence: [],
    rationale: "Não evidenciado",
  }));
describe("PV-001 observer, reflection and persisted version", () => {
  it("preserves exactly twelve replacement criteria", () => {
    expect(CHECKLIST).toHaveLength(12);
    expect(JSON.stringify(CHECKLIST)).not.toMatch(/neuropatia|retinopatia|obesidade|pé diabético/);
  });
  it("rejects judging the live scene", () => {
    expect(() => validateEvaluation(createSession("aluno", "sessao", start), empty())).toThrow();
  });
  it("requires exact real student evidence and rejects invented competence", () => {
    const s = consultation();
    const raw = empty();
    raw[0] = {
      criterion: "vinculo",
      status: "A",
      evidence: [{ turn: 2, student_text: "Entendo seu medo." }],
      rationale: "Acolhimento explícito antes da conduta",
    };
    raw[1] = {
      criterion: "compartilhada",
      status: "A",
      evidence: [{ turn: 2, student_text: "Decidiremos juntos" }],
      rationale: "Fictício",
    };
    raw[2] = {
      criterion: "cronicidade",
      status: "A",
      evidence: [{ turn: 1, student_text: "Vou acabar fazendo diálise?" }],
      rationale: "Fala da paciente não é evidência do aluno",
    };
    raw[3] = { criterion: "risco", status: "A", evidence: [], rationale: "Sem evidência" };
    const result = validateEvaluation(s, raw);
    expect(result.items[0]?.status).toBe("A");
    expect(result.items.slice(1, 4).every((j) => j.status === "NR")).toBe(true);
    expect(result.rejected).toEqual(["compartilhada", "cronicidade", "risco"]);
    expect(result.certifying).toBe(false);
    expect(result.humanReviewRequired).toBe(true);
  });
  it("requires evidence for a human review too", () => {
    const items = empty();
    items[0]!.status = "A";
    expect(() =>
      validateReview(consultation(), {
        reviewer: "docente",
        at: new Date().toISOString(),
        note: "Revisto",
        items,
      }),
    ).toThrow();
  });
  it("persists the full record without silently migrating old versions", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => {
        map.set(key, value);
      },
      length: 0,
      key: (_index: number) => null,
    };
    const r: RecordEnvelope = { session: consultation(), evaluation: null, reviews: [] };
    saveRecord(storage, r);
    expect(loadRecord(storage, "sessao")).toEqual(r);
    const previous = JSON.parse(JSON.stringify(r));
    previous.session.case_version = "1.0";
    storage.setItem(STORAGE_PREFIX + "sessao", JSON.stringify(previous));
    expect(() => saveRecord(storage, r)).toThrow(/imutáveis/);
    expect(() => loadRecord(storage, "sessao")).toThrow(/Versão incompatível/);
    expect(JSON.parse(storage.getItem(STORAGE_PREFIX + "sessao")!).session.case_version).toBe(
      "1.0",
    );
  });
});
