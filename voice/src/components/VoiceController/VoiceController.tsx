import { useState } from "react";
import type { JarvisController } from "../../hooks/useJarvis";
import { WakeButton } from "../WakeButton/WakeButton";
import "./VoiceController.css";

/** Bottom-centre controls: mic permission, the wake button, hint, and the typing fallback. */
export function VoiceController({ jarvis }: { jarvis: JarvisController }) {
  const [text, setText] = useState("");
  const { state, permission, wakeWord, recognitionSupported } = jarvis;
  const needsPermission = permission !== "granted" && permission !== "denied" && permission !== "unsupported";

  const hint =
    state === "listening"
      ? "Go ahead. I'm listening."
      : state === "thinking"
        ? " "
        : state === "speaking"
          ? 'Say "stop" or tap to interrupt.'
          : !recognitionSupported
            ? "Voice isn't supported in this browser. Type below."
            : wakeWord && permission === "granted"
              ? "Say “Hey Jarvis” to wake me."
              : "Tap to wake me, or press Space.";

  return (
    <div className="controller">
      {needsPermission && state === "sleeping" && (
        <div className="permission" role="note">
          <p className="permission__title">Allow microphone access</p>
          <p className="permission__body">
            JARVIS needs your microphone to hear you. It only listens after you wake it (or, if you turn it on, for “Hey Jarvis”). Nothing is recorded.
          </p>
          <button className="permission__btn" onClick={() => jarvis.enableMic()}>
            Enable microphone
          </button>
        </div>
      )}

      <WakeButton state={state} onPress={jarvis.primaryAction} paused={jarvis.paused} />
      <p className="controller__hint" aria-live="polite">{hint}</p>

      <form
        className="typebar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          jarvis.send(text);
          setText("");
        }}
      >
        <input
          className="typebar__input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Type a message to JARVIS"
          maxLength={4000}
        />
        <button className="typebar__send" disabled={!text.trim()} aria-label="Send">
          ↵
        </button>
      </form>
    </div>
  );
}
