/**
 * Centralised assistant state machine.
 *
 * A tiny external store (no React re-render on every frame): components subscribe via
 * useAssistantState(), while the avatar's animation loop reads getAssistantState() and
 * the live audio level directly each frame.
 */
import { useSyncExternalStore } from "react";

export const STATES = {
  SLEEPING: "sleeping", // dormant: face barely visible
  READY: "ready", // awake, waiting for "Hey Jarvis" or the wake button
  WAKING: "waking", // ~1.2 s wake-up transition
  LISTENING: "listening", // capturing the user's request
  THINKING: "thinking", // waiting for the AI
  SPEAKING: "speaking", // reply being spoken
} as const;
export type AssistantState = (typeof STATES)[keyof typeof STATES];

/** Which transitions are allowed. Anything else is ignored (and logged in dev). */
const TRANSITIONS: Record<AssistantState, AssistantState[]> = {
  sleeping: ["waking", "ready", "listening", "thinking"],
  ready: ["waking", "listening", "thinking", "sleeping"],
  waking: ["listening", "speaking", "ready", "sleeping"],
  listening: ["thinking", "ready", "sleeping", "speaking", "listening"],
  thinking: ["speaking", "ready", "listening", "sleeping"],
  speaking: ["listening", "ready", "sleeping", "thinking"],
};

let state: AssistantState = STATES.SLEEPING;
let enteredAt = performance.now();
const listeners = new Set<() => void>();

export function getAssistantState() {
  return state;
}
/** ms since the current state began (used by the wake animation). */
export function timeInState() {
  return performance.now() - enteredAt;
}

export function setAssistantState(next: AssistantState) {
  if (next === state) return true;
  if (!TRANSITIONS[state].includes(next)) {
    if (import.meta.env.DEV) console.warn(`[jarvis] ignored transition ${state} → ${next}`);
    return false;
  }
  state = next;
  enteredAt = performance.now();
  listeners.forEach((l) => l());
  return true;
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAssistantState() {
  return useSyncExternalStore(subscribe, getAssistantState, getAssistantState);
}

/**
 * Live audio level 0..1, written by whichever source is active (mic while listening,
 * voice output while speaking) and read by the avatar every frame. Not React state.
 */
export const audioLevel = { current: 0, source: "none" as "none" | "mic" | "voice" };

/**
 * One-shot head gestures (nod / shake), read by the avatar loop. Not React state.
 */
export type Gesture = "nod" | "shake";
export const gesture = { kind: null as Gesture | null, at: 0 };
export function triggerGesture(kind: Gesture) {
  gesture.kind = kind;
  gesture.at = performance.now();
}

/** Picks a gesture from how a reply starts: "Yes, …" nods, "No, …" shakes. */
export function gestureForReply(text: string): Gesture | null {
  const s = text.trim().toLowerCase().replace(/^[^a-z]+/, "").slice(0, 60);
  if (/^(no\b|nope|not really|not quite|don'?t\b|never\b|i wouldn'?t|i would not|i disagree|that'?s not|unfortunately|wrong\b|i can'?t)/.test(s)) return "shake";
  if (/^(yes|yeah|yep|sure|absolutely|exactly|correct|right\b|of course|definitely|agreed|i agree|good\b|great\b|done\b|understood|got it|noted|certainly|indeed|perfect|okay|ok\b|alright)/.test(s)) return "nod";
  return null;
}
