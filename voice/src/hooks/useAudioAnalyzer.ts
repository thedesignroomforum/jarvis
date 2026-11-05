import { useEffect, useRef } from "react";
import { MicService } from "../services/micService";
import { audioLevel, getAssistantState } from "../state/assistantState";

/**
 * Feeds the live microphone level into the shared audioLevel while JARVIS is listening.
 * Releases the microphone and stops the loop on unmount.
 */
export function useAudioAnalyzer() {
  const micRef = useRef<MicService | null>(null);
  if (!micRef.current) micRef.current = new MicService();

  useEffect(() => {
    const mic = micRef.current!;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!mic.isOpen) return;
      if (getAssistantState() === "listening") {
        audioLevel.current = mic.level();
        audioLevel.source = "mic";
      } else if (audioLevel.source === "mic") {
        audioLevel.current = 0;
        audioLevel.source = "none";
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mic.release();
    };
  }, []);

  return micRef.current;
}
