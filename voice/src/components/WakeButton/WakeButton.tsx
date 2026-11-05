import type { AssistantState } from "../../state/assistantState";
import "./WakeButton.css";

const LABELS: Record<AssistantState, string> = {
  sleeping: "WAKE JARVIS",
  ready: "WAKE JARVIS",
  waking: "WAKING…",
  listening: "LISTENING…",
  thinking: "THINKING…",
  speaking: "SPEAKING…",
};

const HINTS: Partial<Record<AssistantState, string>> = {
  listening: "Tap to send",
  speaking: "Tap to interrupt",
};

/** Minimal circular control: concentric rings that breathe with the assistant's state. */
export function WakeButton({ state, onPress, paused }: { state: AssistantState; onPress: () => void; paused?: boolean }) {
  const label = paused ? "PAUSED" : LABELS[state];
  return (
    <button
      className="wake"
      data-state={state}
      onClick={onPress}
      aria-label={`${label}${HINTS[state] ? `. ${HINTS[state]}` : ""}`}
      disabled={state === "thinking" || state === "waking"}
    >
      <span className="wake__rings" aria-hidden>
        <span className="wake__ring wake__ring--outer" />
        <span className="wake__ring wake__ring--inner" />
        <span className="wake__core" />
      </span>
      <span className="wake__label">{label}</span>
      <span className="wake__hint" aria-hidden>{HINTS[state] ?? " "}</span>
    </button>
  );
}
