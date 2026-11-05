/**
 * Speech recognition manager (browser Web Speech API).
 *
 * One recognition engine, three modes:
 *  - "wake":      experimental always-on listening for "Hey Jarvis" (restarts itself when the browser stops it)
 *  - "command":   capture one request; ends after a short silence
 *  - "interrupt": while JARVIS speaks, only short control words count ("stop", "pause", …)
 *
 * Honest limits: this is NOT a hardware wake word. It only runs while this tab is open
 * and the browser allows it; Chrome/Edge send audio to their speech service; Safari
 * support varies; Firefox has none. The wake button always works as the primary path.
 */

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  0: RecognitionAlternative;
  length: number;
}
interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

export function getRecognitionCtor(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
export const speechRecognitionSupported = () => typeof window !== "undefined" && !!getRecognitionCtor();

export type RecognitionMode = "off" | "wake" | "command" | "interrupt";

export interface RecognitionCallbacks {
  /** "Hey Jarvis" heard. `rest` is anything said after it in the same breath. */
  onWake: (rest: string) => void;
  /** A complete request in command mode. */
  onCommand: (text: string) => void;
  /** Live partial transcript in command mode. */
  onInterim: (text: string) => void;
  /** A control word while JARVIS is speaking. */
  onInterrupt: (word: string) => void;
  /** Command mode ended with no speech. */
  onSilence: () => void;
  onError: (kind: "not-allowed" | "network" | "unsupported" | "other", detail?: string) => void;
}

const WAKE_RE = /\b(?:hey|hi|hello|ok|okay|yo|a)?[\s,]*(?:jarvis|jervis|jarvi|travis|javis|jarviss)\b[\s,.!?]*(.*)$/i;
const INTERRUPT_RE = /^(?:jarvis[\s,]*)?(stop|pause|wait|hold on|enough|quiet|be quiet|shut up|continue|resume|go on|sleep|go to sleep)[.!]?$/i;

export class SpeechService {
  private rec: Recognition | null = null;
  private mode: RecognitionMode = "off";
  private running = false;
  private finalText = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private commandTimeout: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private heardSomething = false;

  constructor(private cb: RecognitionCallbacks) {}

  getMode() {
    return this.mode;
  }

  /** Switch modes; restarts the engine so each mode gets a clean transcript. */
  setMode(mode: RecognitionMode) {
    this.clearTimers();
    this.mode = mode;
    this.finalText = "";
    this.heardSomething = false;
    if (mode === "off") {
      this.stopEngine();
      return;
    }
    if (mode === "command") {
      // Give up if nothing is said for 8 s.
      this.commandTimeout = setTimeout(() => {
        if (this.mode === "command" && !this.heardSomething) this.cb.onSilence();
      }, 8000);
    }
    this.restartEngine();
  }

  destroy() {
    this.mode = "off";
    this.clearTimers();
    this.stopEngine();
  }

  private clearTimers() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    if (this.commandTimeout) clearTimeout(this.commandTimeout);
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.silenceTimer = this.commandTimeout = this.restartTimer = null;
  }

  private stopEngine() {
    if (this.rec) {
      this.rec.onend = null;
      this.rec.onresult = null;
      this.rec.onerror = null;
      try {
        this.rec.abort();
      } catch {
        /* already stopped */
      }
    }
    this.rec = null;
    this.running = false;
  }

  private restartEngine() {
    this.stopEngine();
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      this.cb.onError("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-GB";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      this.running = true;
    };
    rec.onresult = (e) => this.handleResult(e);
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.mode = "off";
        this.cb.onError("not-allowed");
      } else if (e.error === "network") {
        this.failures++;
        this.cb.onError("network");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        this.failures++;
        this.cb.onError("other", e.error);
      }
    };
    rec.onend = () => {
      this.running = false;
      // Browsers stop continuous recognition periodically. Restart while a mode is active,
      // backing off if it keeps failing.
      if (this.mode === "off") return;
      if (this.failures > 6) {
        this.mode = "off";
        this.cb.onError("other", "Speech recognition keeps stopping. Use the wake button or type instead.");
        return;
      }
      const delay = Math.min(4000, 250 * 2 ** this.failures);
      this.restartTimer = setTimeout(() => {
        if (this.mode !== "off") this.restartEngine();
      }, delay);
    };
    this.rec = rec;
    try {
      rec.start();
    } catch {
      // "already started" race; onend will retry
    }
  }

  private handleResult(e: RecognitionEvent) {
    this.failures = 0;
    let interim = "";
    let newFinal = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) newFinal += r[0].transcript;
      else interim += r[0].transcript;
    }

    if (this.mode === "wake") {
      const heard = (newFinal || interim).trim();
      const m = heard.match(WAKE_RE);
      if (m) {
        // Wait for the final result if they kept talking ("Hey Jarvis, what should I…").
        if (!newFinal && m[1] && m[1].length > 0) return;
        const rest = (m[1] || "").trim();
        this.cb.onWake(rest);
      }
      return;
    }

    if (this.mode === "interrupt") {
      const heard = (newFinal || interim).trim().toLowerCase();
      const m = heard.match(INTERRUPT_RE);
      if (m) this.cb.onInterrupt(m[1]);
      return;
    }

    if (this.mode === "command") {
      if (newFinal || interim) this.heardSomething = true;
      this.finalText += newFinal;
      this.cb.onInterim((this.finalText + interim).trim());
      // End of utterance: a short pause after speech.
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      this.silenceTimer = setTimeout(() => {
        const text = (this.finalText + interim).trim();
        if (this.mode === "command" && text) this.cb.onCommand(text);
      }, newFinal && !interim ? 900 : 1600);
    }
  }

  isRunning() {
    return this.running;
  }
}
