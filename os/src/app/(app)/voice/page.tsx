"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Orb } from "@/components/Orb";
import { Markdown } from "@/components/Markdown";
import { useJarvis } from "@/components/JarvisProvider";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { MODES, MODE_IDS, type ModeId } from "@/lib/jarvis/modes";
import type { ChatStreamEvent } from "@/lib/jarvis/types";
import { IconMic, IconStop } from "@/components/icons";

/**
 * Voice conversation: browser speech-to-text → JARVIS → ElevenLabs text-to-speech.
 * Tap to talk; tap again while JARVIS speaks to interrupt.
 */
export default function VoicePage() {
  const { orbState, setOrbState, level, flash } = useJarvis();
  const voice = useVoiceOutput();
  const [mode, setMode] = useState<ModeId>("normal");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ttsReady, setTtsReady] = useState<boolean | null>(null);
  const convRef = useRef<string | null>(null);
  convRef.current = conversationId;

  useEffect(() => {
    fetch("/api/status").then(async (r) => setTtsReady(((await r.json()) as { elevenlabs: boolean }).elevenlabs)).catch(() => setTtsReady(false));
  }, []);

  const ask = useCallback(
    async (text: string) => {
      setHeard(text);
      setReply("");
      setError(null);
      setBusy(true);
      setOrbState("thinking");
      let full = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: convRef.current,
            mode,
            message: text,
            voice: true,
            attachments: [],
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        if (!res.ok || !res.body) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "Request failed");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as ChatStreamEvent;
            if (ev.type === "meta") setConversationId(ev.conversationId);
            if (ev.type === "text") {
              full += ev.text;
              setReply(full);
            }
            if (ev.type === "error") throw new Error(ev.message);
          }
        }
        setBusy(false);
        if (ttsReady) await voice.speak(full);
        else setOrbState("idle");
      } catch (e) {
        setBusy(false);
        setError((e as Error).message);
        flash("warning", 2000);
      }
    },
    [mode, setOrbState, ttsReady, voice, flash],
  );

  const speech = useSpeechInput(ask);

  useEffect(() => {
    if (speech.listening) setOrbState("listening");
  }, [speech.listening, setOrbState]);

  const onOrb = () => {
    if (voice.speaking) return voice.stop(); // interrupt
    if (speech.listening) return speech.stop();
    if (!busy) speech.start();
  };

  const statusText = speech.listening
    ? "Listening…"
    : busy
      ? "Thinking…"
      : voice.speaking
        ? "Speaking · tap to interrupt"
        : "Tap the orb and speak";

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] max-w-2xl flex-col items-center px-5 pt-10 pb-16 lg:min-h-dvh">
      <div className="flex flex-wrap justify-center gap-1.5">
        {MODE_IDS.map((id) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`rounded-full border px-3 py-1 text-[12px] ${mode === id ? "border-text bg-text text-bg" : "border-border text-muted hover:text-text"}`}
          >
            {MODES[id].label}
          </button>
        ))}
      </div>

      <button onClick={onOrb} className="mt-12 rounded-full outline-offset-8" aria-label={statusText}>
        <Orb size={260} state={orbState} level={speech.listening ? 0.4 : level} />
      </button>
      <p className="mt-6 text-[15px] text-muted" aria-live="polite">{statusText}</p>

      <div className="mt-4 flex gap-2">
        {speech.listening || voice.speaking ? (
          <button className="btn" onClick={onOrb}><IconStop className="h-4 w-4" /> Stop</button>
        ) : (
          <button className="btn btn-primary" onClick={onOrb} disabled={busy || !speech.supported}><IconMic className="h-4 w-4" /> Talk</button>
        )}
      </div>

      <div className="mt-6 w-full space-y-2 text-[13px]">
        {!speech.supported && <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-warn">This browser has no built-in speech recognition. Use Chrome, Edge or Safari, or type in Chat.</p>}
        {ttsReady === false && (
          <p className="rounded-xl border border-border px-3 py-2 text-muted">
            Voice replies are off: ElevenLabs isn&apos;t configured. JARVIS will answer in text. Add <code>ELEVENLABS_API_KEY</code> (free plan works). See <Link href="/settings" className="underline">Settings</Link>.
          </p>
        )}
        {(error || voice.error || speech.error) && <p className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-warn">{error || voice.error || speech.error}</p>}
      </div>

      {(heard || speech.interim) && (
        <div className="mt-8 w-full space-y-4">
          <p className="text-right text-[15px] text-muted">“{speech.interim || heard}”</p>
          {reply && (
            <div className="card p-4">
              <Markdown>{reply}</Markdown>
            </div>
          )}
          {conversationId && (
            <Link href={`/chat?c=${conversationId}`} className="block text-center text-[12.5px] text-muted hover:text-text">
              Continue this conversation in Chat
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
