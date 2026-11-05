/**
 * The JARVIS controller: wires speech recognition, the AI service, voice output, memory
 * and the state machine together. UI components only call the actions it returns.
 *
 *   Hey Jarvis / Wake button → WAKING → "Yes. I'm listening." → LISTENING → (speech) →
 *   THINKING → SPEAKING → short follow-up LISTENING → READY → (inactivity) → SLEEPING
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { askJarvis, AIServiceError, getServerConfig, type Turn } from "../services/aiService";
import { parseCommand } from "../services/commands";
import { CATEGORY_LABELS, memoryStore } from "../services/memoryService";
import { queryMicPermission, type MicPermission } from "../services/micService";
import type { VoiceEngine } from "../services/voiceOutput";
import { gestureForReply, getAssistantState, setAssistantState, STATES, triggerGesture, useAssistantState } from "../state/assistantState";
import { useAudioAnalyzer } from "./useAudioAnalyzer";
import { useSpeechRecognition } from "./useSpeechRecognition";
import { useSpeechSynthesis } from "./useSpeechSynthesis";

export type MicStatus = "off" | "ready" | "listening";
export interface TranscriptEntry {
  id: number;
  role: "user" | "jarvis" | "system";
  text: string;
}

const GREETING = "Yes. I'm listening.";
const INACTIVITY_MS = 90_000;
const WAKE_MS = 1200;

function readBool(key: string, fallback: boolean) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}
function writeBool(key: string, v: boolean) {
  try {
    localStorage.setItem(key, v ? "1" : "0");
  } catch {
    /* ignore */
  }
}

let entryId = 0;

export function useJarvis() {
  const state = useAssistantState();
  const clapHandler = useRef<(() => void) | null>(null);
  const mic = useAudioAnalyzer(clapHandler);
  const { voice, voices, defaultVoice } = useSpeechSynthesis();

  const [permission, setPermission] = useState<MicPermission>("unknown");
  const [micStatus, setMicStatus] = useState<MicStatus>("off");
  const [wakeWord, setWakeWordState] = useState(() => readBool("jarvis.wakeWord", false));
  const [clapWake, setClapWakeState] = useState(() => readBool("jarvis.clapWake", true));
  const [voiceOn, setVoiceOnState] = useState(() => readBool("jarvis.voiceOn", true));
  const [voiceName, setVoiceNameState] = useState<string | null>(() => {
    try {
      return localStorage.getItem("jarvis.voiceName");
    } catch {
      return null;
    }
  });
  const [engine, setEngine] = useState<VoiceEngine>("browser");
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [needAccessCode, setNeedAccessCode] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [interim, setInterim] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const history = useRef<Turn[]>([]);
  const lastReply = useRef("");
  const inactivity = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeWordRef = useRef(wakeWord);
  wakeWordRef.current = wakeWord;
  const permissionRef = useRef(permission);
  permissionRef.current = permission;
  const busyToken = useRef(0); // invalidates stale async work after an interruption

  const add = useCallback((role: TranscriptEntry["role"], text: string) => {
    setTranscript((t) => [...t.slice(-30), { id: ++entryId, role, text }]);
  }, []);

  // ── Speech recognition ────────────────────────────────────────────────
  const handlers = useRef({
    wake: (_rest: string) => {},
    command: (_t: string) => {},
    interrupt: (_w: string) => {},
    silence: () => {},
  });
  const { speech, supported: recognitionSupported } = useSpeechRecognition({
    onWake: (rest) => handlers.current.wake(rest),
    onCommand: (t) => handlers.current.command(t),
    onInterim: (t) => setInterim(t),
    onInterrupt: (w) => handlers.current.interrupt(w),
    onSilence: () => handlers.current.silence(),
    onError: (kind, detail) => {
      if (kind === "not-allowed") {
        setPermission("denied");
        setMicStatus("off");
        setNotice("Microphone access is required for voice interaction. You can still use Jarvis by typing.");
      } else if (kind === "unsupported") {
        setNotice("Voice recognition isn't available in this browser. Use Chrome, Edge or Safari, or type below.");
      } else if (kind === "network") {
        setNotice("Speech recognition lost its connection. It will retry; you can also type.");
      } else if (detail) {
        setNotice(detail);
      }
    },
  });

  /** Background listening mode when not in a conversation. */
  const idleRecognition = useCallback(() => {
    speech.setMode(wakeWordRef.current && permissionRef.current === "granted" ? "wake" : "off");
  }, [speech]);

  const armInactivity = useCallback(() => {
    if (inactivity.current) clearTimeout(inactivity.current);
    inactivity.current = setTimeout(() => {
      if (getAssistantState() === STATES.READY) setAssistantState(STATES.SLEEPING);
    }, INACTIVITY_MS);
  }, []);

  const goReady = useCallback(() => {
    setInterim("");
    setAssistantState(STATES.READY);
    setMicStatus(permissionRef.current === "granted" ? "ready" : "off");
    idleRecognition();
    armInactivity();
  }, [idleRecognition, armInactivity]);

  const goSleep = useCallback(() => {
    voice.stop();
    setInterim("");
    setAssistantState(STATES.SLEEPING);
    setMicStatus(permissionRef.current === "granted" ? "ready" : "off");
    idleRecognition();
  }, [voice, idleRecognition]);

  const listen = useCallback(() => {
    if (permissionRef.current !== "granted" || !recognitionSupported) {
      goReady();
      return;
    }
    setInterim("");
    setAssistantState(STATES.LISTENING);
    setMicStatus("listening");
    speech.setMode("command");
  }, [speech, recognitionSupported, goReady]);

  /** Speak, then open a short follow-up window. Resolves when speech ends. */
  const speakText = useCallback(
    async (text: string, after: "listen" | "ready" | "sleep" = "listen") => {
      const token = ++busyToken.current;
      if (!voiceOn) {
        if (after === "sleep") goSleep();
        else if (after === "listen") listen();
        else goReady();
        return;
      }
      setAssistantState(STATES.SPEAKING);
      const g = gestureForReply(text);
      if (g) triggerGesture(g);
      setPaused(false);
      // While speaking, only control words are recognised ("stop", "pause"…).
      speech.setMode(permissionRef.current === "granted" ? "interrupt" : "off");
      setMicStatus(permissionRef.current === "granted" ? "ready" : "off");
      const completed = await voice.speak(text, { engine, voiceName: voiceName ?? defaultVoice });
      if (token !== busyToken.current) return; // something else took over
      if (!completed) return listen();
      if (after === "sleep") goSleep();
      else if (after === "listen") listen();
      else goReady();
    },
    [voice, engine, voiceName, defaultVoice, voiceOn, speech, listen, goReady, goSleep],
  );

  const reportError = useCallback(
    (err: unknown) => {
      const e = err instanceof AIServiceError ? err : new AIServiceError("unavailable", "I'm having trouble reaching my intelligence service. Try again.");
      if (e.kind === "access-code") {
        setNeedAccessCode(true);
        goReady();
        return;
      }
      setNotice(e.message);
      add("system", e.message);
      setAssistantState(STATES.THINKING); // ensure a valid path to ready
      goReady();
    },
    [add, goReady],
  );

  const askAI = useCallback(
    async (text: string, opts: { echo?: string; voiceReply?: boolean } = {}) => {
      const token = ++busyToken.current;
      voice.stop();
      speech.setMode("off");
      setInterim("");
      setNotice(null);
      setAssistantState(STATES.THINKING);
      setMicStatus(permissionRef.current === "granted" ? "ready" : "off");
      try {
        const reply = await askJarvis(text, history.current, { voice: opts.voiceReply ?? true });
        if (token !== busyToken.current) return;
        history.current = [...history.current, { role: "user" as const, content: opts.echo ?? text }, { role: "assistant" as const, content: reply }].slice(-16);
        lastReply.current = reply;
        add("jarvis", reply);
        await speakText(reply, "listen");
      } catch (err) {
        if (token !== busyToken.current) return;
        reportError(err);
      }
    },
    [voice, speech, add, speakText, reportError],
  );

  /** Every input (voice or typed) goes through here. */
  const handleInput = useCallback(
    async (raw: string, source: "voice" | "text") => {
      const text = raw.trim();
      if (!text) return;
      if (inactivity.current) clearTimeout(inactivity.current);
      const cmd = parseCommand(text);
      if (cmd.type !== "stop" && cmd.type !== "pause" && cmd.type !== "continue") add("user", text);

      switch (cmd.type) {
        case "stop":
          busyToken.current++;
          voice.stop();
          return listen();
        case "pause":
          voice.pause();
          setPaused(true);
          return;
        case "continue":
          if (voice.paused) {
            voice.resume();
            setPaused(false);
            return;
          }
          return askAI("Continue.", { voiceReply: source === "voice" });
        case "repeat":
          if (!lastReply.current) return speakText("I haven't said anything yet.");
          add("jarvis", lastReply.current);
          return speakText(lastReply.current);
        case "deeper":
          return askAI("Go deeper on your last answer. Give me the substance, still concise enough to say out loud.", { echo: text });
        case "summarize":
          return askAI("Summarise your last answer in two sentences.", { echo: text });
        case "sleep":
          add("jarvis", "Going quiet.");
          setAssistantState(STATES.THINKING);
          return speakText("Going quiet.", "sleep");
        case "wake":
          add("jarvis", GREETING);
          setAssistantState(STATES.THINKING);
          return speakText(GREETING, "listen");
        case "remember": {
          const item = memoryStore.add(cmd.text);
          const msg = `Noted. Saved under ${CATEGORY_LABELS[item.category]}.`;
          add("jarvis", msg);
          setAssistantState(STATES.THINKING);
          return speakText(msg, "listen");
        }
        case "forget": {
          const removed = memoryStore.forgetMatching(cmd.text);
          const msg = removed ? `Done. I've forgotten: ${removed.text}` : "I don't have anything stored that matches that.";
          add("jarvis", msg);
          setAssistantState(STATES.THINKING);
          return speakText(msg, "listen");
        }
        case "forgetLast": {
          const removed = memoryStore.forgetLast();
          const msg = removed ? "Forgotten." : "There's nothing in memory to forget.";
          add("jarvis", msg);
          setAssistantState(STATES.THINKING);
          return speakText(msg, "listen");
        }
        case "ask":
          return askAI(cmd.text, { voiceReply: true });
      }
    },
    [add, voice, listen, askAI, speakText],
  );

  // ── Wake ──────────────────────────────────────────────────────────────
  const wake = useCallback(
    (rest = "") => {
      busyToken.current++;
      voice.stop();
      speech.setMode("off");
      setNotice(null);
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
      setAssistantState(STATES.WAKING);
      // Answer the call with a small nod once the head has lifted.
      // (Without a request, the "Yes. I'm listening." greeting nods instead.)
      if (rest) setTimeout(() => getAssistantState() === STATES.WAKING && triggerGesture("nod"), 550);
      wakeTimer.current = setTimeout(() => {
        if (getAssistantState() !== STATES.WAKING) return;
        if (rest && parseCommand(rest).type !== "wake") {
          setAssistantState(STATES.LISTENING);
          handleInput(rest, "voice");
        } else {
          add("jarvis", GREETING);
          speakText(GREETING, "listen");
        }
      }, WAKE_MS);
    },
    [voice, speech, add, speakText, handleInput],
  );

  // Keep recognition callbacks pointing at the latest closures.
  handlers.current = {
    wake: (rest) => {
      const s = getAssistantState();
      if (s === STATES.SLEEPING || s === STATES.READY) wake(rest);
    },
    command: (t) => {
      speech.setMode("off");
      handleInput(t, "voice");
    },
    interrupt: (w) => {
      if (/^(stop|wait|hold on|enough|quiet|be quiet|shut up)$/.test(w)) {
        busyToken.current++;
        voice.stop();
        listen();
      } else if (w === "pause") {
        voice.pause();
        setPaused(true);
      } else if (/^(continue|resume|go on)$/.test(w)) {
        voice.resume();
        setPaused(false);
      } else if (/sleep/.test(w)) {
        goSleep();
      }
    },
    silence: () => {
      if (getAssistantState() === STATES.LISTENING) goReady();
    },
  };

  // Double clap wakes JARVIS (only while asleep/idle and after mic permission).
  clapHandler.current = clapWake
    ? () => {
        const s = getAssistantState();
        if (s === STATES.SLEEPING || s === STATES.READY) wake();
      }
    : null;

  // ── Microphone permission ─────────────────────────────────────────────
  const enableMic = useCallback(async () => {
    const result = await mic.open();
    setPermission(result);
    if (result === "granted") {
      setMicStatus("ready");
      setNotice(null);
      if (getAssistantState() === STATES.SLEEPING) setAssistantState(STATES.READY);
      idleRecognition();
      armInactivity();
      return true;
    }
    setMicStatus("off");
    setNotice(
      result === "denied"
        ? "Microphone access is required for voice interaction. You can still use Jarvis by typing."
        : "No microphone is available here. You can still use Jarvis by typing.",
    );
    return false;
  }, [mic, idleRecognition, armInactivity]);

  /** The central button. */
  const primaryAction = useCallback(async () => {
    const s = getAssistantState();
    if (s === STATES.SPEAKING) {
      busyToken.current++;
      voice.stop();
      return listen();
    }
    if (s === STATES.LISTENING) {
      speech.setMode("off");
      if (interim.trim()) return handleInput(interim, "voice");
      return goReady();
    }
    if (s === STATES.THINKING || s === STATES.WAKING) return;
    if (permissionRef.current !== "granted") {
      const ok = await enableMic();
      if (!ok) return;
    }
    wake();
  }, [voice, listen, speech, interim, handleInput, goReady, enableMic, wake]);

  const cancel = useCallback(() => {
    busyToken.current++;
    voice.stop();
    speech.setMode("off");
    const s = getAssistantState();
    if (s === STATES.WAKING) setAssistantState(STATES.LISTENING);
    goReady();
  }, [voice, speech, goReady]);

  // ── Settings ──────────────────────────────────────────────────────────
  const setWakeWord = useCallback(
    (v: boolean) => {
      setWakeWordState(v);
      wakeWordRef.current = v;
      writeBool("jarvis.wakeWord", v);
      const s = getAssistantState();
      if (s === STATES.SLEEPING || s === STATES.READY) idleRecognition();
    },
    [idleRecognition],
  );
  const setClapWake = useCallback((v: boolean) => {
    setClapWakeState(v);
    writeBool("jarvis.clapWake", v);
  }, []);
  const setVoiceOn = useCallback((v: boolean) => {
    setVoiceOnState(v);
    writeBool("jarvis.voiceOn", v);
  }, []);
  const setVoiceName = useCallback((name: string | null) => {
    setVoiceNameState(name);
    try {
      if (name) localStorage.setItem("jarvis.voiceName", name);
      else localStorage.removeItem("jarvis.voiceName");
    } catch {
      /* ignore */
    }
  }, []);

  // ── Startup & cleanup ─────────────────────────────────────────────────
  useEffect(() => {
    const onNotice = (e: Event) => setNotice((e as CustomEvent<string>).detail);
    window.addEventListener("jarvis:notice", onNotice);
    return () => window.removeEventListener("jarvis:notice", onNotice);
  }, []);
  useEffect(() => {
    getServerConfig().then((c) => {
      setAiConfigured(c.ai);
      setEngine(c.elevenlabs ? "elevenlabs" : "browser");
      if (c.accessCode) {
        try {
          if (!localStorage.getItem("jarvis.accessCode")) setNeedAccessCode(true);
        } catch {
          setNeedAccessCode(true);
        }
      }
    });
    // If permission was granted on a previous visit, we still wait for a click before
    // opening the mic (browsers also need a gesture to start audio).
    queryMicPermission().then((p) => {
      if (p === "denied" || p === "unsupported") setPermission(p);
    });
    return () => {
      if (inactivity.current) clearTimeout(inactivity.current);
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
    };
  }, []);

  return {
    state,
    permission,
    micStatus,
    recognitionSupported,
    wakeWord,
    setWakeWord,
    clapWake,
    setClapWake,
    voiceOn,
    setVoiceOn,
    voices,
    voiceName: voiceName ?? defaultVoice,
    setVoiceName,
    engine,
    aiConfigured,
    needAccessCode,
    setNeedAccessCode,
    transcript,
    interim,
    notice,
    setNotice,
    paused,
    enableMic,
    primaryAction,
    cancel,
    send: (text: string) => handleInput(text, "text"),
  };
}

export type JarvisController = ReturnType<typeof useJarvis>;
