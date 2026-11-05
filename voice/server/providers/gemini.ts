import { ProviderConfigError, type AIMessage, type AIProvider, type AIRequest } from "./types.js";

/**
 * Google Gemini via its REST API. Free tier (no card) at aistudio.google.com/apikey.
 * Set GEMINI_API_KEY. Optional GEMINI_MODEL to force one model.
 *
 * Model names change over time, so when no model is forced we ask Google which models this
 * key can use and pick the best fast one. Every attempt is recorded so failures are explainable.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const FALLBACK_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash-lite"];
const PER_CALL_MS = 15000;
const TOTAL_MS = 40000;

export interface Attempt {
  model: string;
  status: number | "timeout" | "network";
  ms: number;
  note?: string;
}

// Survives between requests while the serverless instance stays warm.
let rememberedModel: string | null = null;
let discovered: { at: number; models: string[] } | null = null;

const clean = (v?: string) => (v || "").trim().replace(/^["']|["']$/g, "").trim();

export function getGeminiKey(): string {
  const aiKey = clean(process.env.AI_API_KEY);
  return clean(process.env.GEMINI_API_KEY) || (process.env.AI_PROVIDER === "gemini" || /^(AIza|AQ\.)/.test(aiKey) ? aiKey : "");
}

/** Text models this key can call, best first (Flash, newest, stable before preview). */
export async function discoverModels(apiKey: string): Promise<{ models: string[]; status: number | string }> {
  if (discovered && Date.now() - discovered.at < 10 * 60_000) return { models: discovered.models, status: "cached" };
  try {
    const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(6000) });
    if (!r.ok) return { models: [], status: r.status };
    const data = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
    const names = (data.models || [])
      .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m) => m.name.replace(/^models\//, ""))
      .filter((n) => /gemini/i.test(n) && !/(image|tts|audio|live|embedding|vision|robotics|computer|native|thinking)/i.test(n));
    const version = (n: string) => parseFloat(n.match(/(\d+(?:\.\d+)?)/)?.[1] || "0");
    const score = (n: string) =>
      (/flash/i.test(n) ? 1000 : /pro/i.test(n) ? 300 : 0) -
      (/lite/i.test(n) ? 100 : 0) -
      (/(preview|exp)/i.test(n) ? 80 : 0) -
      (/\d{3,}$|-\d{2}-\d{2}/.test(n) ? 20 : 0) + // dated snapshots after the plain name
      version(n) * 10;
    const models = names.sort((a, b) => score(b) - score(a)).slice(0, 5);
    discovered = { at: Date.now(), models };
    return { models, status: r.status };
  } catch (e) {
    return { models: [], status: (e as Error).name === "TimeoutError" ? "timeout" : "network" };
  }
}

/** Gemini wants user/model turns that start with the user and alternate. */
function toContents(messages: AIMessage[]) {
  const out: { role: "user" | "model"; parts: { text: string }[] }[] = [];
  for (const m of messages) {
    const role = m.role === "assistant" ? "model" : "user";
    if (!out.length && role === "model") continue; // drop a leading greeting
    const last = out[out.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n${m.content}`;
    else out.push({ role, parts: [{ text: m.content }] });
  }
  return out;
}

export async function runGemini(req: AIRequest, apiKey: string) {
  const attempts: Attempt[] = [];
  const started = Date.now();
  const payload = {
    systemInstruction: { parts: [{ text: `${req.system}\n\n${req.context}` }] },
    contents: toContents(req.messages),
    generationConfig: { maxOutputTokens: req.voice ? 500 : 4096, temperature: 0.7 },
  };
  // Newer Gemini models "think" first, which is slow for voice. Ask for none; if a model
  // rejects that setting, retry it without.
  const lean = JSON.stringify({ ...payload, generationConfig: { ...payload.generationConfig, thinkingConfig: { thinkingBudget: 0 } } });
  const plain = JSON.stringify(payload);

  const call = async (model: string, body = lean): Promise<Response | null> => {
    const left = TOTAL_MS - (Date.now() - started);
    if (left < 3000) return null;
    const t0 = Date.now();
    try {
      const r = await fetch(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body,
        signal: AbortSignal.timeout(Math.min(PER_CALL_MS, left)),
      });
      const note = r.ok ? undefined : (await r.clone().text()).match(/"message":\s*"([^"]{0,140})/)?.[1];
      attempts.push({ model, status: r.status, ms: Date.now() - t0, note });
      if (body === lean && r.status === 400 && /thinking/i.test(note || "")) return call(model, plain);
      return r;
    } catch (e) {
      attempts.push({ model, status: (e as Error).name === "TimeoutError" ? "timeout" : "network", ms: Date.now() - t0 });
      return null;
    }
  };

  const forced = clean(process.env.GEMINI_MODEL);
  // Fast path: go straight to the model that worked last (or the usual best one). Only ask
  // Google for its model list if that one isn't available.
  let candidates: string[] = forced ? [forced] : [rememberedModel || FALLBACK_MODELS[0]];
  let discoveredList = !!forced;

  for (let i = 0; i < candidates.length && i < 6; i++) {
    const model = candidates[i];
    const res = await call(model);
    if (!res) {
      // timeout / network: try the next model
      if (!discoveredList && i === candidates.length - 1) candidates = [...new Set([...candidates, ...FALLBACK_MODELS])];
      continue;
    }
    if (res.ok) {
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
        promptFeedback?: { blockReason?: string };
      };
      rememberedModel = model;
      if (data.promptFeedback?.blockReason) {
        return { text: "I can't help with that one as asked. Tell me what you're actually trying to achieve and I'll find a better route.", attempts, model };
      }
      const text = (data.candidates?.[0]?.content?.parts || [])
        .filter((p) => !p.thought)
        .map((p) => p.text || "")
        .join("")
        .trim();
      return { text: text || "I don't have a good answer to that yet.", attempts, model };
    }
    // A bad key or exhausted quota won't be fixed by another model.
    if (res.status === 401 || res.status === 403 || res.status === 429) break;
    if (res.status === 400 && !/not found|not supported|unknown model|is not available/i.test(attempts.at(-1)?.note || "")) break;
    if (!discoveredList && i === candidates.length - 1) {
      discoveredList = true;
      const found = await discoverModels(apiKey);
      candidates = [...new Set([...candidates, ...found.models, ...FALLBACK_MODELS])];
    }
  }
  return { text: null, attempts, model: null };
}

export function describeAttempts(attempts: Attempt[]): string {
  return attempts.map((a) => `${a.model}: ${a.status} in ${(a.ms / 1000).toFixed(1)}s${a.note ? ` (${a.note})` : ""}`).join("; ");
}

export function createGeminiProvider(): AIProvider {
  const apiKey = getGeminiKey();
  if (!apiKey) throw new ProviderConfigError("GEMINI_API_KEY is not set on the server.");
  return {
    get name() {
      return `gemini:${rememberedModel || "auto"}`;
    },
    async ask(req: AIRequest) {
      const result = await runGemini(req, apiKey);
      if (result.text !== null) return result.text;
      const last = result.attempts.at(-1);
      const status = typeof last?.status === "number" ? last.status : 504;
      throw Object.assign(new Error(`gemini failed: ${describeAttempts(result.attempts) || "no attempts"}`), { status, attempts: result.attempts });
    },
  };
}
