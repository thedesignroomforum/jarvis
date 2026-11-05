"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { OrbState } from "./Orb";

type Theme = "dark" | "light";

interface JarvisContextValue {
  orbState: OrbState;
  setOrbState: (s: OrbState) => void;
  /** Flash a transient state (warning/success) then return to idle. */
  flash: (s: "warning" | "success", ms?: number) => void;
  level: number;
  setLevel: (l: number) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  voiceReplies: boolean;
  setVoiceReplies: (v: boolean) => void;
}

const JarvisContext = createContext<JarvisContextValue | null>(null);

function readPref<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: preference just won't persist */
  }
}

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [level, setLevel] = useState(0);
  const [theme, setThemeState] = useState<Theme>("dark");
  const [voiceReplies, setVoiceState] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setThemeState(readPref<Theme>("jarvis.theme", "dark"));
    setVoiceState(readPref<boolean>("jarvis.voiceReplies", false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writePref("jarvis.theme", t);
  }, []);
  const setVoiceReplies = useCallback((v: boolean) => {
    setVoiceState(v);
    writePref("jarvis.voiceReplies", v);
  }, []);
  const flash = useCallback((s: "warning" | "success", ms = 1400) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setOrbState(s);
    flashTimer.current = setTimeout(() => setOrbState("idle"), ms);
  }, []);

  const value = useMemo(
    () => ({ orbState, setOrbState, flash, level, setLevel, theme, setTheme, voiceReplies, setVoiceReplies }),
    [orbState, flash, level, theme, setTheme, voiceReplies, setVoiceReplies],
  );
  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used inside JarvisProvider");
  return ctx;
}
