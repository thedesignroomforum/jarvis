import { useEffect, useRef } from "react";
import type { TranscriptEntry } from "../../hooks/useJarvis";
import "./Conversation.css";

/** Small, elegant transcript. Never dominates the avatar; can be hidden (T). */
export function Conversation({ entries, interim, visible }: { entries: TranscriptEntry[]; interim: string; visible: boolean }) {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [entries, interim]);
  if (!visible) return null;
  const recent = entries.slice(-8);
  return (
    <section className="convo" aria-label="Conversation transcript">
      <ol ref={ref} className="convo__list">
        {recent.map((e) => (
          <li key={e.id} className={`convo__item convo__item--${e.role}`}>
            <span className="convo__who">{e.role === "user" ? "YOU" : e.role === "jarvis" ? "JARVIS" : "SYSTEM"}</span>
            <p className="convo__text">{e.role === "system" ? e.text : `“${e.text}”`}</p>
          </li>
        ))}
        {interim && (
          <li className="convo__item convo__item--user convo__item--interim">
            <span className="convo__who">YOU</span>
            <p className="convo__text">“{interim}”</p>
          </li>
        )}
      </ol>
    </section>
  );
}
