import { useEffect, useRef, useState } from "react";
import { listEnglishVoices, pickBestVoice, VoiceOutput, voicesReady } from "../services/voiceOutput";

/** Voice output instance + the device's available English voices (they load asynchronously). */
export function useSpeechSynthesis() {
  const outRef = useRef<VoiceOutput | null>(null);
  if (!outRef.current) outRef.current = new VoiceOutput();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [defaultVoice, setDefaultVoice] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      if (!alive) return;
      setVoices(listEnglishVoices());
      setDefaultVoice(pickBestVoice()?.name ?? null);
    };
    voicesReady().then(refresh);
    if ("speechSynthesis" in window) speechSynthesis.addEventListener("voiceschanged", refresh);
    return () => {
      alive = false;
      if ("speechSynthesis" in window) speechSynthesis.removeEventListener("voiceschanged", refresh);
      outRef.current?.stop();
    };
  }, []);

  return { voice: outRef.current, voices, defaultVoice };
}
