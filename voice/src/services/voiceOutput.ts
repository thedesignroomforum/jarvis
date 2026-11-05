/**
 * Voice output with two engines:
 *  1. ElevenLabs (via /api/tts, key stays on the server) — real audio, so the avatar reacts
 *     to the true amplitude of the voice.
 *  2. Browser SpeechSynthesis fallback — the best male English voice on this device. Browsers
 *     don't expose its audio to Web Audio, so the avatar is driven by word-boundary events
 *     shaped into a speech-like envelope.
 */
import { audioLevel } from "../state/assistantState";
import { analyzeAudio, createAnalyser, getAudioContext, resumeAudio } from "./audioAnalyzer";
import { authHeaders } from "./aiService";

export type VoiceEngine = "elevenlabs" | "browser";

// Ranked preferences: calm, deeper, natural-sounding male English voices first.
const PREFERRED = [
  /^(Daniel|Arthur|Oliver|Malcolm|Evan|Nathan|Tom|Aaron|Gordon) \((Premium|Enhanced)\)/i, // Apple's high-quality male voices
  /Microsoft (Ryan|Thomas|Guy|Christopher|Andrew|Brian|Davis|Eric|Steffan).*(Natural|Online)/i,
  /Google UK English Male/i,
  /^Daniel( \(Enhanced\)| \(Premium\))?/i,
  /^Arthur/i,
  /^(Oliver|Malcolm|Gordon|Aaron|Evan|Nathan|Tom)( \(Enhanced\)| \(Premium\))?/i,
  /Microsoft (George|Ryan|Mark|David)/i,
  /^Alex$/i,
];
const NOVELTY = /(Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Fred|Junior|Ralph|Grandpa|Rocko|Eddy|Reed)/i;

export function listEnglishVoices(): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en") && !NOVELTY.test(v.name));
}

export function pickBestVoice(preferredName?: string | null): SpeechSynthesisVoice | null {
  const voices = listEnglishVoices();
  if (preferredName) {
    const chosen = voices.find((v) => v.name === preferredName);
    if (chosen) return chosen;
  }
  for (const re of PREFERRED) {
    const v = voices.find((x) => re.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => /male/i.test(v.name)) || voices.find((v) => v.lang === "en-GB") || voices[0] || null;
}

/** Voices load asynchronously in some browsers. */
export function voicesReady(): Promise<void> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window) || speechSynthesis.getVoices().length) return resolve();
    const done = () => resolve();
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

interface SpeakOptions {
  engine: VoiceEngine;
  voiceName?: string | null;
  onStart?: () => void;
}

export class VoiceOutput {
  private audio: HTMLAudioElement | null = null;
  private raf = 0;
  private envelope = 0;
  private speakingBrowser = false;
  private abort: AbortController | null = null;
  private resolveCurrent: ((completed: boolean) => void) | null = null;
  paused = false;

  /** Resolves true when finished naturally, false if interrupted. */
  async speak(text: string, opts: SpeakOptions): Promise<boolean> {
    this.stop();
    if (opts.engine === "elevenlabs") {
      try {
        return await this.speakElevenLabs(text, opts);
      } catch {
        // Fall through to the device voice if ElevenLabs fails (quota, network).
      }
    }
    return this.speakBrowser(text, opts);
  }

  private async speakElevenLabs(text: string, opts: SpeakOptions): Promise<boolean> {
    const ac = new AbortController();
    this.abort = ac;
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ text }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    if (ac.signal.aborted) return false;

    await resumeAudio();
    const audio = new Audio(URL.createObjectURL(blob));
    this.audio = audio;
    const src = getAudioContext().createMediaElementSource(audio);
    const analyser = createAnalyser(src);
    analyser.connect(getAudioContext().destination);

    return new Promise<boolean>((resolve) => {
      this.resolveCurrent = resolve;
      const tick = () => {
        audioLevel.current = analyzeAudio(analyser);
        audioLevel.source = "voice";
        this.raf = requestAnimationFrame(tick);
      };
      audio.onplay = () => opts.onStart?.();
      audio.onended = () => this.finish(true);
      audio.onerror = () => this.finish(false);
      audio.play().then(tick, () => this.finish(false));
    });
  }

  private speakBrowser(text: string, opts: SpeakOptions): Promise<boolean> {
    if (!("speechSynthesis" in window)) return Promise.resolve(false);
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickBestVoice(opts.voiceName);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    }
    u.rate = 1; // natural pace (slowing it down sounds robotic)
    u.pitch = 1; // altering pitch makes device voices sound synthetic
    u.volume = 1;

    return new Promise<boolean>((resolve) => {
      this.resolveCurrent = resolve;
      this.speakingBrowser = true;
      this.envelope = 0.3;
      const tick = () => {
        // Speech-like envelope: decays between words, with a little natural flutter.
        if (!this.paused) this.envelope *= 0.93;
        const flutter = this.paused ? 0 : 0.08 + Math.random() * 0.1;
        audioLevel.current = Math.min(1, this.envelope + (this.speakingBrowser ? flutter : 0));
        audioLevel.source = "voice";
        this.raf = requestAnimationFrame(tick);
      };
      u.onstart = () => {
        opts.onStart?.();
        tick();
      };
      u.onboundary = (e) => {
        const len = e.charLength || 5;
        const word = text.substr(e.charIndex, len);
        const emphasis = /[A-Z!?]/.test(word) ? 0.2 : 0;
        this.envelope = Math.min(1, 0.35 + Math.min(len, 12) * 0.04 + emphasis + Math.random() * 0.1);
      };
      u.onend = () => this.finish(true);
      u.onerror = () => this.finish(false);
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      // Chrome sometimes never fires onstart for the first utterance; start the meter anyway.
      setTimeout(() => {
        if (this.speakingBrowser && !this.raf) tick();
      }, 400);
    });
  }

  private finish(completed: boolean) {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.speakingBrowser = false;
    this.paused = false;
    audioLevel.current = 0;
    audioLevel.source = "none";
    if (this.audio) {
      URL.revokeObjectURL(this.audio.src);
      this.audio = null;
    }
    const r = this.resolveCurrent;
    this.resolveCurrent = null;
    r?.(completed);
  }

  pause() {
    this.paused = true;
    if (this.audio) this.audio.pause();
    else if ("speechSynthesis" in window) speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    if (this.audio) this.audio.play().catch(() => {});
    else if ("speechSynthesis" in window) speechSynthesis.resume();
  }

  /** Interrupt immediately. */
  stop() {
    this.abort?.abort();
    this.abort = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.pause();
    }
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    if (this.resolveCurrent) this.finish(false);
  }
}
