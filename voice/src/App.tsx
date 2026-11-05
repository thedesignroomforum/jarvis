import { Component, useEffect, useState, type ReactNode } from "react";
import { Avatar } from "./components/Avatar/Avatar";
import { Conversation } from "./components/Conversation/Conversation";
import { MemoryPanel } from "./components/MemoryPanel/MemoryPanel";
import { StatusIndicator } from "./components/StatusIndicator/StatusIndicator";
import { VoiceController } from "./components/VoiceController/VoiceController";
import { useJarvis } from "./hooks/useJarvis";
import { setAccessCode } from "./services/aiService";

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el as HTMLElement).isContentEditable);

function Jarvis() {
  const jarvis = useJarvis();
  const [showTranscript, setShowTranscript] = useState(() => {
    try {
      return localStorage.getItem("jarvis.transcript") !== "0";
    } catch {
      return true;
    }
  });
  const [panel, setPanel] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      return localStorage.getItem("jarvis.theme") === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "light" ? "#ffffff" : "#000000");
    try {
      localStorage.setItem("jarvis.theme", theme);
    } catch {
      /* private mode */
    }
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const [code, setCode] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem("jarvis.transcript", showTranscript ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, [showTranscript]);

  // Keyboard: Space wake/send/interrupt, Esc cancel, T transcript, M memory & settings.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Escape") {
        if (panel) setPanel(false);
        else jarvis.cancel();
        return;
      }
      if (isTyping(document.activeElement)) return;
      if (e.code === "Space") {
        // Let a focused button handle its own Space press.
        if (document.activeElement?.tagName === "BUTTON") return;
        e.preventDefault();
        jarvis.primaryAction();
      } else if (e.key === "t" || e.key === "T") {
        setShowTranscript((v) => !v);
      } else if (e.key === "m" || e.key === "M") {
        setPanel((v) => !v);
      } else if (e.key === "l" || e.key === "L") {
        setTheme((t) => (t === "light" ? "dark" : "light"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jarvis, panel]);

  const online = jarvis.permission === "granted";

  return (
    <div className="app">
      <h1 className="sr-only">JARVIS voice assistant</h1>
      <Avatar offline={!online} light={theme === "light"} />

      <header className="topbar">
        <span className="topbar__brand">JARVIS</span>
        <StatusIndicator state={jarvis.state} mic={jarvis.micStatus} online={online} />
      </header>

      <div className="tools">
        <button
          type="button"
          className="tool"
          aria-pressed={showTranscript}
          onClick={() => setShowTranscript((v) => !v)}
          title="Transcript (T)"
        >
          Transcript
        </button>
        <button type="button" className="tool" onClick={() => setPanel(true)} title="Memory & settings (M)">
          Memory
        </button>
        <button
          type="button"
          className="tool"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          title="Light / dark (L)"
        >
          {theme === "light" ? "Dark" : "Light"}
        </button>
      </div>

      <Conversation entries={jarvis.transcript} interim={jarvis.interim} visible={showTranscript} />

      <div className="notices" aria-live="polite">
        {jarvis.aiConfigured === false && !jarvis.notice && (
          <p className="notice notice--quiet">
            <span>
              AI is not configured yet. Add <code>GEMINI_API_KEY</code> (free) or <code>AI_API_KEY</code> on the server.
            </span>
          </p>
        )}
        {jarvis.notice && (
          <p className="notice" role="status">
            <span>{jarvis.notice}</span>
            <button type="button" className="notice__close" aria-label="Dismiss" onClick={() => jarvis.setNotice(null)}>
              ×
            </button>
          </p>
        )}
      </div>

      <footer className="dock">
        <VoiceController jarvis={jarvis} />
      </footer>

      {panel && <MemoryPanel jarvis={jarvis} onClose={() => setPanel(false)} />}

      {jarvis.needAccessCode && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="access-title">
          <form
            className="modal__card"
            onSubmit={(e) => {
              e.preventDefault();
              if (!code.trim()) return;
              setAccessCode(code.trim());
              setCode("");
              jarvis.setNeedAccessCode(false);
              jarvis.setNotice(null);
            }}
          >
            <p id="access-title" className="modal__title">Access code</p>
            <p className="modal__body">This JARVIS is private. Enter the access code set on the server.</p>
            <input
              className="modal__input"
              type="password"
              autoFocus
              autoComplete="current-password"
              aria-label="Access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="modal__btn" type="submit">Unlock</button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Last line of defence: the app never shows a blank crash screen. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.error("[jarvis]", err);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="crash">
        <p>JARVIS hit an unexpected problem.</p>
        <button type="button" className="modal__btn" onClick={() => location.reload()}>Restart</button>
      </div>
    );
  }
}

export function App() {
  return (
    <Boundary>
      <Jarvis />
    </Boundary>
  );
}
