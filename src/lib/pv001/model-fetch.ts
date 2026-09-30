/**
 * MiMo models think step by step by default, which takes several seconds per call. Classifying
 * a sentence or voicing a short line does not need it, so it is turned off on MiMo endpoints.
 * PV001_MODEL_THINKING=true restores the provider default. Other providers are left untouched.
 */
export function withoutThinking(
  baseURL: string,
  env: Record<string, string | undefined> = process.env,
  base: typeof fetch = fetch,
): typeof fetch {
  const mimo = /(^|\.)xiaomimimo\.com$/.test(new URL(baseURL).hostname);
  if (!mimo || env["PV001_MODEL_THINKING"] === "true") return base;
  return async (input, init) => {
    if (init?.body && typeof init.body === "string") {
      try {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        body["thinking"] = { type: "disabled" };
        init = { ...init, body: JSON.stringify(body) };
      } catch {
        /* Non-JSON bodies are sent as they are. */
      }
    }
    return base(input, init);
  };
}
