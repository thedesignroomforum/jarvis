import { ProviderConfigError, type AIProvider, type AIRequest } from "./types.js";

/**
 * Google Gemini via its REST API. Has a free tier (no card) at aistudio.google.com/apikey.
 * Set GEMINI_API_KEY. Optional GEMINI_MODEL (default "gemini-flash-latest").
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";

/** 404, or a 400 saying the model isn't found / doesn't support generateContent. Leaves res readable. */
async function isMissingModel(res: Response) {
  if (res.status === 404) return true;
  if (res.status !== 400) return false;
  const text = await res.clone().text();
  return /not found|not supported|is not available|unknown model/i.test(text);
}

/** Text models this key can call, best first (Flash, newest version, stable before preview). */
async function discoverModels(apiKey: string): Promise<string[]> {
  try {
    const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": apiKey } });
    if (!r.ok) return [];
    const data = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /gemini/i.test(n) && !/(image|tts|audio|live|embedding|vision|robotics|computer|native)/i.test(n));
    const version = (n: string) => parseFloat(n.match(/(\d+(?:\.\d+)?)/)?.[1] || "0");
    const score = (n: string) =>
      (/flash/i.test(n) ? 1000 : /pro/i.test(n) ? 500 : 0) -
      (/lite/i.test(n) ? 200 : 0) -
      (/(preview|exp)/i.test(n) ? 50 : 0) +
      version(n) * 10 +
      (/latest/i.test(n) ? 5 : 0);
    return names.sort((a, b) => score(b) - score(a)).slice(0, 6);
  } catch {
    return [];
  }
}

export function createGeminiProvider(): AIProvider {
  // Keys pasted into Vercel sometimes carry spaces, quotes or a newline; strip them.
  const clean = (v?: string) => (v || "").trim().replace(/^["']|["']$/g, "").trim();
  const aiKey = clean(process.env.AI_API_KEY);
  const apiKey = clean(process.env.GEMINI_API_KEY) || (process.env.AI_PROVIDER === "gemini" || /^(AIza|AQ\.)/.test(aiKey) ? aiKey : "");
  if (!apiKey) throw new ProviderConfigError("GEMINI_API_KEY is not set on the server.");
  // Model names change over time; start with the configured one and discover others if it's gone.
  let model = clean(process.env.GEMINI_MODEL) || "gemini-flash-latest";

  return {
    get name() {
      return `gemini:${model}`;
    },
    async ask(req: AIRequest) {
      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: `${req.system}\n\n${req.context}` }] },
        contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: req.voice ? 1024 : 4096, temperature: 0.7 },
      });
      const call = (m: string) =>
        fetch(`${BASE}/models/${encodeURIComponent(m)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body,
        });
      let res = await call(model);
      if (await isMissingModel(res)) {
        // Ask Google which models this key can use, and try the best ones in order.
        for (const m of await discoverModels(apiKey)) {
          if (m === model) continue;
          res = await call(m);
          if (!(await isMissingModel(res))) {
            model = m; // remember it for the next request
            break;
          }
        }
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 400);
        throw Object.assign(new Error(`gemini ${res.status} (${model}): ${detail}`), { status: res.status });
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
        promptFeedback?: { blockReason?: string };
      };
      if (data.promptFeedback?.blockReason) {
        return "I can't help with that one as asked. Tell me what you're actually trying to achieve and I'll find a better route.";
      }
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
      return text || "I don't have a good answer to that yet.";
    },
  };
}
