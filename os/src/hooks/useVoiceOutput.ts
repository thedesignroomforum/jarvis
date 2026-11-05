"use client";

import { useCallback, useRef, useState } from "react";
import { useJarvis } from "@/components/JarvisProvider";

/**
 * Plays JARVIS replies through ElevenLabs (via our server route, so the key never reaches
 * the browser). Drives the orb's "speaking" animation from the audio level and supports
 * interruption with stop().
 */
export function useVoiceOutput() {
  const { setOrbState, setLevel } = useJarvis();
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    cancelAnimationFrame(rafRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setSpeaking(false);
    setLevel(0);
    setOrbState("idle");
  }, [setLevel, setOrbState]);

  const speak = useCallback(
    async (text: string) => {
      stop();
      setError(null);
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/voice/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string; setup?: string };
          setError([data.error, data.setup].filter(Boolean).join(" ") || "Voice unavailable.");
          return;
        }
        const blob = await res.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        audioRef.current = audio;

        // Level meter for the orb.
        ctxRef.current ??= new AudioContext();
        const actx = ctxRef.current;
        if (actx.state === "suspended") await actx.resume();
        const src = actx.createMediaElementSource(audio);
        const analyser = actx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        analyser.connect(actx.destination);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          analyser.getByteFrequencyData(buf);
          let sum = 0;
          for (const v of buf) sum += v;
          setLevel(Math.min(1, sum / buf.length / 90));
          rafRef.current = requestAnimationFrame(tick);
        };

        audio.onended = () => stop();
        setSpeaking(true);
        setOrbState("speaking");
        await audio.play();
        tick();
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError("Couldn't play voice reply.");
        stop();
      }
    },
    [setLevel, setOrbState, stop],
  );

  return { speak, stop, speaking, error };
}
