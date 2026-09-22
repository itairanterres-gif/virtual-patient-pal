import { expect, it } from "vitest";
import { newSessionId } from "../pv001/session-id";

it("starts distinct sessions on HTTP where randomUUID is unavailable", () => {
  const random = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const ids = new Set(Array.from({ length: 100 }, () => newSessionId(random)));
  expect(ids.size).toBe(100);
  for (const id of ids)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

it("uses native randomUUID when available", () => {
  const native = "8d3df2c4-1c7a-42c8-ae42-359b3e127005";
  expect(
    newSessionId({
      randomUUID: () => native,
      getRandomValues: () => {
        throw new Error("Fallback unexpected");
      },
    }),
  ).toBe(native);
});
