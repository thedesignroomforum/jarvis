import { getProvider, ProviderConfigError, type AIMessage } from "./providers/index.js";
import { JARVIS_SYSTEM_PROMPT, VOICE_RULES } from "./prompts/jarvisSystemPrompt.js";
import { checkAccess, json, rateLimit } from "./security.js";

const MEMORY_KEYS = ["personal", "career", "finance", "business", "learning", "habits", "relationships", "currentState"] as const;
const LABELS: Record<(typeof MEMORY_KEYS)[number], string> = {
  personal: "Personal",
  career: "Career",
  finance: "Finance",
  business: "Business",
  learning: "Learning",
  habits: "Habits",
  relationships: "Relationships",
  currentState: "Current State",
};

interface ChatBody {
  message: string;
  history?: AIMessage[];
  memory?: { name?: string; items?: { category: string; text: string }[] };
  voice?: boolean;
  timezone?: string;
}

function str(v: unknown, max: number) {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Validate untrusted input instead of trusting the browser. */
function parse(raw: unknown): ChatBody | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const message = str(b.message, 8000).trim();
  if (!message) return null;
  const history = Array.isArray(b.history)
    ? b.history
        .slice(-16)
        .filter((m): m is AIMessage => !!m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
        .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
    : [];
  const mem = (b.memory ?? {}) as Record<string, unknown>;
  const items = Array.isArray(mem.items)
    ? mem.items
        .slice(0, 200)
        .filter((i): i is { category: string; text: string } => !!i && typeof i.category === "string" && typeof i.text === "string")
        .map((i) => ({ category: i.category.slice(0, 40), text: i.text.slice(0, 1000) }))
    : [];
  return {
    message,
    history,
    memory: { name: str(mem.name, 80), items },
    voice: b.voice !== false,
    timezone: str(b.timezone, 64) || "Africa/Lagos",
  };
}

function buildContext(body: ChatBody) {
  const now = new Date().toLocaleString("en-GB", { timeZone: body.timezone, dateStyle: "full", timeStyle: "short" });
  const lines: string[] = [`Current date/time for Adebayo: ${now} (${body.timezone}).`];
  const items = body.memory?.items ?? [];
  lines.push("", "MEMORY (exactly what is stored; nothing else is remembered):");
  if (body.memory?.name) lines.push(`Name: ${body.memory.name}`);
  if (!items.length) lines.push("(No saved memories yet.)");
  for (const key of MEMORY_KEYS) {
    const list = items.filter((i) => i.category === key);
    if (list.length) lines.push(`${LABELS[key]}:`, ...list.map((i) => `- ${i.text}`));
  }
  lines.push(
    "",
    "APP CAPABILITIES: The app saves memories only when Adebayo says \"remember …\" and deletes them with \"forget …\". You cannot browse the web, read files, or set reminders in this app yet; say so if asked.",
  );
  if (body.voice) lines.push("", VOICE_RULES);
  return lines.join("\n");
}

export async function handleChat(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const denied = checkAccess(req) ?? rateLimit(req, "chat");
  if (denied) return denied;

  const body = parse(await req.json().catch(() => null));
  if (!body) return json({ error: "INVALID_REQUEST" }, 400);

  try {
    const provider = getProvider();
    const reply = await provider.ask({
      system: JARVIS_SYSTEM_PROMPT,
      context: buildContext(body),
      messages: [...(body.history ?? []), { role: "user", content: body.message }],
      voice: body.voice ?? true,
    });
    return json({ reply });
  } catch (err) {
    if (err instanceof ProviderConfigError) return json({ error: "NOT_CONFIGURED", detail: err.message }, 503);
    console.error("[jarvis] AI error", err);
    return json({ error: "AI_UNAVAILABLE", reason: explain(err) }, 502);
  }
}

/** A short, secret-free reason so the owner can see what went wrong without opening server logs. */
function explain(err: unknown): string {
  const msg = String((err as { message?: string })?.message || err || "");
  const status = Number((err as { status?: number })?.status) || Number(msg.match(/\b(\d{3})\b/)?.[1]) || 0;
  if (status === 401 || status === 403 || /api key|API_KEY_INVALID|authentication|permission/i.test(msg))
    return "The AI key was rejected. Check the key in Vercel's Environment Variables, then redeploy.";
  if (status === 429 || /quota|rate|exhausted/i.test(msg)) return "The AI provider's free limit is used up for now. Try again later.";
  if (status === 402 || /credit|billing|balance/i.test(msg)) return "The AI account has no credit.";
  if (status === 404 || /not found|not supported/i.test(msg)) return `The AI model wasn't available: ${providerMessage(msg)}`;
  if (status >= 500) return `The AI provider is having problems right now: ${providerMessage(msg)}`;
  return `Unexpected AI error: ${providerMessage(msg)}`;
}

/** The provider's own error text, trimmed, with anything key-like removed. */
function providerMessage(msg: string): string {
  const m = msg.match(/"message":\s*"([^"]+)"/)?.[1] || msg;
  return m.replace(/(AIza|AQ\.|sk-)[\w.\-]{8,}/g, "[key]").slice(0, 160);
}
