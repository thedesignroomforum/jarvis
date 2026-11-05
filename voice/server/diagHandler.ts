import { discoverModels, getGeminiKey, runGemini } from "./providers/gemini.js";
import { checkAccess, json, rateLimit } from "./security.js";

/**
 * GET /api/diag — a quick health check the owner can open in a browser.
 * Shows which AI/voice keys are present (never the keys), which Gemini models the key can use,
 * and a tiny live test with timings. Protected by the access code when one is set.
 */
export async function handleDiag(req: Request): Promise<Response> {
  const denied = checkAccess(req, true);
  if (denied) return denied;
  const limited = rateLimit(req, "diag", 6);
  if (limited) return limited;

  const key = getGeminiKey();
  const report: Record<string, unknown> = {
    keys: {
      GEMINI_API_KEY: Boolean(process.env.GEMINI_API_KEY),
      AI_API_KEY: Boolean(process.env.AI_API_KEY),
      AI_API_KEY_looks_like: process.env.AI_API_KEY ? (/^\s*["']?(AIza|AQ\.)/.test(process.env.AI_API_KEY) ? "google" : /^\s*["']?sk-ant-/.test(process.env.AI_API_KEY) ? "anthropic" : "unknown") : null,
      ELEVENLABS_API_KEY: Boolean(process.env.ELEVENLABS_API_KEY),
      GEMINI_MODEL: process.env.GEMINI_MODEL || null,
    },
  };
  if (key) {
    const t0 = Date.now();
    const found = await discoverModels(key);
    report.listModels = { status: found.status, ms: Date.now() - t0, best: found.models };
    const run = await runGemini(
      { system: "You are a test. Reply with exactly: OK", context: "", messages: [{ role: "user", content: "Say OK" }], voice: true },
      key,
    );
    report.test = { ok: run.text !== null, reply: run.text, model: run.model, attempts: run.attempts };
  } else {
    report.test = "No Gemini key found on the server.";
  }
  return json(report, 200);
}
