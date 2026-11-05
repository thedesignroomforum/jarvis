import { checkAccess, json, rateLimit } from "./security.js";

/** Strip markdown and trim so the free ElevenLabs credits go further. */
function speakable(text: string, max: number) {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_#`>|~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : cut;
}

/** ElevenLabs text-to-speech proxy. The API key never leaves the server. */
export async function handleTts(req: Request): Promise<Response> {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);
  const key = elevenKey();
  if (!key) return json({ error: "TTS_NOT_CONFIGURED" }, 501);
  const denied = checkAccess(req) ?? rateLimit(req, "tts");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? speakable(body.text, Number(process.env.ELEVENLABS_MAX_CHARS || 700)) : "";
  if (!text) return json({ error: "INVALID_REQUEST" }, 400);

  const res = await elevenTts(key, text);
  if (!res.ok || !res.body) {
    const detail = elevenError(res.status, await res.text().catch(() => ""));
    console.error("[jarvis] ElevenLabs", res.status, detail);
    return json({ error: "TTS_FAILED", status: res.status, reason: detail }, 502);
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}

const clean = (v?: string) => (v || "").trim().replace(/^["']|["']$/g, "").trim();
export const elevenKey = () => clean(process.env.ELEVENLABS_API_KEY);

export function elevenTts(key: string, text: string, signal?: AbortSignal) {
  const voice = clean(process.env.ELEVENLABS_VOICE_ID) || "JBFqnCBsd6RMkjVDRZzb";
  return fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true },
    }),
    signal,
  });
}

/** Turns an ElevenLabs error into a plain sentence (never includes the key). */
export function elevenError(status: number, body: string): string {
  let msg = "";
  try {
    const d = JSON.parse(body) as { detail?: { status?: string; message?: string } | string };
    msg = typeof d.detail === "string" ? d.detail : [d.detail?.status, d.detail?.message].filter(Boolean).join(": ");
  } catch {
    msg = body.slice(0, 200);
  }
  msg = msg.replace(/sk_[A-Za-z0-9]+/g, "[key]").slice(0, 240);
  if (/unusual_activity|unusual activity/i.test(msg)) return `ElevenLabs blocked the free plan from this server (${status}): ${msg}`;
  if (status === 401) return `ElevenLabs rejected the key (401). Check ELEVENLABS_API_KEY, and that the key has Text to Speech access. ${msg}`;
  if (/quota|credits/i.test(msg)) return `ElevenLabs free characters are used up (${status}). ${msg}`;
  if (/voice/i.test(msg) && (status === 400 || status === 402 || status === 404)) return `ElevenLabs can't use this voice on your plan (${status}). Try another ELEVENLABS_VOICE_ID. ${msg}`;
  return `ElevenLabs error ${status}. ${msg}`;
}

/** Which optional services are configured (booleans only). */
export function handleConfig(): Response {
  return json({
    ai: Boolean(process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY),
    elevenlabs: Boolean(elevenKey()),
    accessCode: Boolean(process.env.JARVIS_ACCESS_CODE),
  });
}
