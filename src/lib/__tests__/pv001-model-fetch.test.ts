import { describe, expect, it } from "vitest";
import { withoutThinking } from "../pv001/model-fetch";

function recorder() {
  const sent: unknown[] = [];
  const base = (async (_url: unknown, init?: RequestInit) => {
    sent.push(init?.body ? JSON.parse(String(init.body)) : null);
    return new Response("{}");
  }) as typeof fetch;
  return { sent, base };
}

describe("PV-001 model requests", () => {
  it("turns off MiMo deep thinking, keeping the rest of the body", async () => {
    const { sent, base } = recorder();
    const f = withoutThinking("https://api.xiaomimimo.com/v1", {}, base);
    await f("https://api.xiaomimimo.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "mimo-v2.6-flash", messages: [] }),
    });
    expect(sent[0]).toEqual({
      model: "mimo-v2.6-flash",
      messages: [],
      thinking: { type: "disabled" },
    });
  });
  it("leaves other providers and an explicit opt-in untouched", () => {
    const { base } = recorder();
    expect(withoutThinking("https://api.openai.com/v1", {}, base)).toBe(base);
    expect(
      withoutThinking("https://api.xiaomimimo.com/v1", { PV001_MODEL_THINKING: "true" }, base),
    ).toBe(base);
  });
});
