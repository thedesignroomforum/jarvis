import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";

const bodySchema = z.object({ text: z.string().trim().min(1).max(5000) });

/** Strip markdown so the voice doesn't read symbols aloud, and trim to the free-tier budget. */
function speakable(text: string, max: number) {
  const plain = text
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return (lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : cut) + " The rest is on screen.";
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;

  if (!serverEnv.elevenKey) {
    return NextResponse.json(
      {
        error: "Voice output is not configured.",
        setup: "Add ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID) to your environment. The free ElevenLabs plan works. See README → ElevenLabs.",
      },
      { status: 501 },
    );
  }

  const limited = rateLimit(`tts:${auth.user.id}`);
  if (!limited.ok) return NextResponse.json({ error: "Too many voice requests" }, { status: 429 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid text" }, { status: 400 });

  const text = speakable(parsed.data.text, serverEnv.elevenMaxChars);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(serverEnv.elevenVoice)}/stream?output_format=mp3_44100_64`,
    {
      method: "POST",
      headers: { "xi-api-key": serverEnv.elevenKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: serverEnv.elevenModel,
        // Calm, steady, natural: higher stability, moderate similarity, light style.
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.15, use_speaker_boost: true },
      }),
    },
  );

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    const quota = res.status === 401 || /quota|credits|limit/i.test(detail);
    console.error("[tts]", res.status, detail.slice(0, 300));
    return NextResponse.json(
      {
        error: quota
          ? "ElevenLabs refused the request. Check the API key and whether this month's free credits are used up."
          : `ElevenLabs error (${res.status}).`,
      },
      { status: 502 },
    );
  }

  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
