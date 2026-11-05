import { useEffect, useRef, useState } from "react";
import { SpeechService, speechRecognitionSupported, type RecognitionCallbacks } from "../services/speechService";

/** Owns one SpeechService for the component's lifetime; callbacks always see fresh props. */
export function useSpeechRecognition(callbacks: RecognitionCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;
  const serviceRef = useRef<SpeechService | null>(null);
  const [supported] = useState(speechRecognitionSupported);

  if (!serviceRef.current) {
    serviceRef.current = new SpeechService({
      onWake: (r) => cbRef.current.onWake(r),
      onCommand: (t) => cbRef.current.onCommand(t),
      onInterim: (t) => cbRef.current.onInterim(t),
      onInterrupt: (w) => cbRef.current.onInterrupt(w),
      onSilence: () => cbRef.current.onSilence(),
      onError: (k, d) => cbRef.current.onError(k, d),
    });
  }
  useEffect(() => () => serviceRef.current?.destroy(), []);
  return { speech: serviceRef.current, supported };
}
