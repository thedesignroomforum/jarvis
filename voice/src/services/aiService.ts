/**
 * Front-end AI service. Talks only to our own /api/chat — never to an AI provider
 * directly, so no API key ever reaches the browser.
 */
import { memoryStore } from "./memoryService";

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

export class AIServiceError extends Error {
  constructor(
    public kind: "not-configured" | "access-code" | "rate-limited" | "unavailable",
    message: string,
  ) {
    super(message);
  }
}

const ACCESS_KEY = "jarvis.accessCode";
export function getAccessCode() {
  try {
    return localStorage.getItem(ACCESS_KEY) || "";
  } catch {
    return "";
  }
}
export function setAccessCode(code: string) {
  try {
    localStorage.setItem(ACCESS_KEY, code);
  } catch {
    /* ignore */
  }
}
export function authHeaders(): Record<string, string> {
  const code = getAccessCode();
  return code ? { "x-jarvis-access": code } : {};
}

/**
 * Ask JARVIS. Sends the message, recent conversation and the user's saved memory;
 * returns the reply text.
 */
export async function askJarvis(message: string, history: Turn[] = [], opts: { voice?: boolean } = {}): Promise<string> {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        message,
        history: history.slice(-12),
        memory: memoryStore.toPayload(),
        voice: opts.voice ?? true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
  } catch {
    throw new AIServiceError("unavailable", "I'm having trouble reaching my intelligence service. Try again.");
  }
  if (res.ok) {
    const data = (await res.json()) as { reply?: string };
    if (data.reply) return data.reply;
  }
  const err = (await res.json().catch(() => ({}))) as { error?: string };
  if (err.error === "NOT_CONFIGURED") throw new AIServiceError("not-configured", "My intelligence service isn't configured yet. Add AI_API_KEY on the server.");
  if (err.error === "ACCESS_CODE_REQUIRED") throw new AIServiceError("access-code", "Access code required.");
  if (err.error === "RATE_LIMITED") throw new AIServiceError("rate-limited", "Too many requests. Give me a moment.");
  throw new AIServiceError("unavailable", "I'm having trouble reaching my intelligence service. Try again.");
}

export async function getServerConfig(): Promise<{ ai: boolean; elevenlabs: boolean; accessCode: boolean }> {
  try {
    const r = await fetch("/api/config");
    if (r.ok) return await r.json();
  } catch {
    /* offline */
  }
  return { ai: false, elevenlabs: false, accessCode: false };
}
