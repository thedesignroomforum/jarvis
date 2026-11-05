import { useEffect, useRef } from "react";
import { MicService } from "../services/micService";
import { audioLevel, getAssistantState } from "../state/assistantState";

/**
 * Feeds the live microphone level into the shared audioLevel while JARVIS is listening.
 * While he is asleep or idle (and only after mic permission), it also watches the level for
 * a double clap: two short, sharp spikes 0.15–0.8 s apart. Only the loudness number is
 * looked at; no audio is recorded or sent anywhere.
 * Releases the microphone and stops the loop on unmount.
 */
export function useAudioAnalyzer(onDoubleClap?: { current: (() => void) | null }) {
  const micRef = useRef<MicService | null>(null);
  if (!micRef.current) micRef.current = new MicService();

  useEffect(() => {
    const mic = micRef.current!;
    let raf = 0;
    let floor = 0.05; // slow-moving background loudness
    let prev = 0;
    let spikeAt = 0; // when the current spike started (0 = none)
    let spikePeak = 0;
    let lastClap = 0;
    let cooldownUntil = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!mic.isOpen) return;
      const state = getAssistantState();
      if (state === "listening") {
        audioLevel.current = mic.level();
        audioLevel.source = "mic";
        return;
      }
      if (audioLevel.source === "mic") {
        audioLevel.current = 0;
        audioLevel.source = "none";
      }
      if (!onDoubleClap?.current || (state !== "sleeping" && state !== "ready")) {
        spikeAt = 0;
        return;
      }

      const now = performance.now();
      const l = mic.level();
      const threshold = Math.max(0.42, floor * 2.4 + 0.2);
      if (!spikeAt) {
        // A clap starts very suddenly, from fairly quiet.
        if (l > threshold && l - prev > 0.18 && now > cooldownUntil) {
          spikeAt = now;
          spikePeak = l;
        } else {
          floor += (l - floor) * 0.02;
        }
      } else {
        spikePeak = Math.max(spikePeak, l);
        const age = now - spikeAt;
        if (l < spikePeak * 0.5 || l < threshold * 0.7) {
          // Short and sharp = a clap. Talking or music stays loud for longer.
          if (age < 180) {
            if (lastClap && now - lastClap > 150 && now - lastClap < 800) {
              lastClap = 0;
              cooldownUntil = now + 2000;
              onDoubleClap.current?.();
            } else lastClap = now;
          } else lastClap = 0;
          spikeAt = 0;
        } else if (age > 260) {
          spikeAt = 0;
          lastClap = 0;
          cooldownUntil = now + 300;
        }
      }
      if (lastClap && now - lastClap > 800) lastClap = 0;
      prev = l;
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mic.release();
    };
  }, [onDoubleClap]);

  return micRef.current;
}
