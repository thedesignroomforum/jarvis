import { useSyncExternalStore } from "react";
import type { JarvisController } from "../../hooks/useJarvis";
import { CATEGORY_LABELS, MEMORY_CATEGORIES, memoryStore } from "../../services/memoryService";
import "./MemoryPanel.css";

/** Memory + voice settings, in a quiet side sheet. */
export function MemoryPanel({ jarvis, onClose }: { jarvis: JarvisController; onClose: () => void }) {
  const data = useSyncExternalStore(memoryStore.subscribe, memoryStore.load, memoryStore.load);
  return (
    <aside className="sheet" role="dialog" aria-label="Memory and settings">
      <div className="sheet__head">
        <span className="sheet__title">MEMORY</span>
        <button className="sheet__close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <p className="sheet__note">
        Say “Jarvis, remember …” to save, “forget …” to remove. Stored on this device only. JARVIS knows nothing else about you.
      </p>
      {data.items.length === 0 && <p className="sheet__empty">Nothing saved yet.</p>}
      {MEMORY_CATEGORIES.map((c) => {
        const items = data.items.filter((i) => i.category === c);
        if (!items.length) return null;
        return (
          <section key={c} className="sheet__group">
            <h3>{CATEGORY_LABELS[c].toUpperCase()}</h3>
            <ul>
              {items.map((i) => (
                <li key={i.id}>
                  <span>{i.text}</span>
                  <button onClick={() => memoryStore.remove(i.id)} aria-label={`Forget: ${i.text}`}>forget</button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {data.items.length > 0 && (
        <button className="sheet__danger" onClick={() => confirm("Forget everything JARVIS has stored?") && memoryStore.clear()}>
          Forget everything
        </button>
      )}

      <div className="sheet__head sheet__head--sub"><span className="sheet__title">SETTINGS</span></div>
      <label className="sheet__row">
        <span>
          Listen for “Hey Jarvis”
          <small>Experimental. Uses your browser's speech recognition while this tab is open.</small>
        </span>
        <input type="checkbox" checked={jarvis.wakeWord} onChange={(e) => jarvis.setWakeWord(e.target.checked)} disabled={!jarvis.recognitionSupported} />
      </label>
      <label className="sheet__row">
        <span>
          Speak replies
          <small>{jarvis.engine === "elevenlabs" ? "Voice: ElevenLabs" : "Voice: this device"}</small>
        </span>
        <input type="checkbox" checked={jarvis.voiceOn} onChange={(e) => jarvis.setVoiceOn(e.target.checked)} />
      </label>
      {jarvis.engine === "browser" && jarvis.voices.length > 0 && (
        <label className="sheet__row sheet__row--col">
          <span>Device voice</span>
          <select value={jarvis.voiceName ?? ""} onChange={(e) => jarvis.setVoiceName(e.target.value || null)}>
            {jarvis.voices.map((v) => (
              <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
            ))}
          </select>
        </label>
      )}
      <p className="sheet__note">Shortcuts: Space wake / send / interrupt · Esc cancel · T transcript · M this panel</p>
    </aside>
  );
}
