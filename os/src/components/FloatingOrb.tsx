"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Orb } from "./Orb";
import { useJarvis } from "./JarvisProvider";
import { QUICK_ACTIONS } from "@/lib/jarvis/quick-actions";
import { IconEye, IconImage, IconMic, IconScreen, IconSearch, IconSend, IconSpark, IconTarget, IconX } from "./icons";

/**
 * The persistent JARVIS shortcut. Bottom-right on every screen; click (or press ⌘/Ctrl + J)
 * to ask anything or jump into a mode.
 */
export function FloatingOrb() {
  const router = useRouter();
  const pathname = usePathname();
  const { orbState, level } = useJarvis();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);
  useEffect(() => setOpen(false), [pathname]);

  // On the voice screen the big orb is the interface.
  if (pathname === "/voice") return null;

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const ask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    go(`/chat?q=${encodeURIComponent(text.trim())}&send=1`);
    setText("");
  };

  const shortcuts = [
    { label: "Voice", icon: IconMic, href: "/voice" },
    { label: "Upload image", icon: IconImage, href: "/design-review" },
    { label: "Share screen", icon: IconScreen, href: "/chat?capture=1" },
    { label: "Research", icon: IconSearch, href: "/research" },
    { label: "Review design", icon: IconEye, href: "/design-review" },
    { label: "Start learning", icon: IconSpark, href: "/learning" },
    { label: "Daily check-in", icon: IconTarget, href: `/chat?mode=coach&q=${encodeURIComponent(QUICK_ACTIONS.find((a) => a.id === "check-in")!.prompt)}&send=1` },
    { label: "My priorities", icon: IconTarget, href: "/today" },
  ];

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div
            className="card fade-up absolute bottom-24 right-4 w-[min(92vw,380px)] p-4 shadow-2xl sm:right-6"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Ask JARVIS"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="label">Ask JARVIS</p>
              <button className="text-muted hover:text-text" onClick={() => setOpen(false)} aria-label="Close">
                <IconX className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={ask} className="flex items-center gap-2">
              <input
                ref={inputRef}
                className="input"
                placeholder="What do you need?"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button className="btn btn-primary h-10 w-10 shrink-0 p-0" aria-label="Ask">
                <IconSend className="h-4 w-4" />
              </button>
            </form>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              {shortcuts.map(({ label, icon: Icon, href }) => (
                <button
                  key={label}
                  onClick={() => go(href)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-text"
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-faint">Tip: press ⌘J / Ctrl+J anywhere.</p>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 grid h-16 w-16 place-items-center rounded-full border border-border bg-surface shadow-xl transition-transform hover:scale-105 sm:right-6"
        aria-label="Open JARVIS"
        aria-expanded={open}
      >
        <Orb size={52} state={orbState} level={level} label="Open JARVIS" />
      </button>
    </>
  );
}
