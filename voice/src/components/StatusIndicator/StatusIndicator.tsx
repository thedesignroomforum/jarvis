import type { AssistantState } from "../../state/assistantState";
import type { MicStatus } from "../../hooks/useJarvis";
import "./StatusIndicator.css";

const STATUS: Record<AssistantState, string> = {
  sleeping: "SLEEPING",
  ready: "READY",
  waking: "WAKING",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "SPEAKING",
};

export function StatusIndicator({ state, mic, online }: { state: AssistantState; mic: MicStatus; online: boolean }) {
  const label = !online && state === "sleeping" ? "OFFLINE" : STATUS[state];
  const micLabel = mic === "off" ? "MIC OFF" : mic === "listening" ? "LISTENING" : "MIC READY";
  return (
    <div className="status" role="status" aria-live="polite">
      <span className="status__item" data-active={online && state !== "sleeping"}>
        <span className="status__dot" aria-hidden />
        {label}
      </span>
      <span className="status__item status__mic" data-mic={mic} aria-label={`Microphone: ${micLabel}`}>
        {micLabel}
      </span>
    </div>
  );
}
