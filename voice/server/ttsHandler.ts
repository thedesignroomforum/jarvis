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
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return json({ error: "TTS_NOT_CONFIGURED" }, 501);
  const denied = checkAccess(req) ?? rateLimit(req, "tts");
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? speakable(body.text, Number(process.env.ELEVENLABS_MAX_CHARS || 700)) : "";
  if (!text) return json({ error: "INVALID_REQUEST" }, 400);

  const voice = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
      voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.12, use_speaker_boost: true },
    }),
  });
  if (!res.ok || !res.body) {
    console.error("[jarvis] ElevenLabs", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return json({ error: "TTS_FAILED", status: res.status }, 502);
  }
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}

/** Which optional services are configured (booleans only). */
export function handleConfig(): Response {
  return json({
    ai: Boolean(process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    accessCode: Boolean(process.env.JARVIS_ACCESS_CODE),
  });
}
