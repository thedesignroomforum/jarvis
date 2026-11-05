"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Orb } from "./Orb";
import { FloatingOrb } from "./FloatingOrb";
import { useJarvis } from "./JarvisProvider";
import {
  IconBook, IconBrain, IconChat, IconEye, IconFolder, IconGear, IconHome, IconMenu, IconMic,
  IconMoon, IconSearch, IconSpark, IconSun, IconTarget, IconX,
} from "./icons";

const NAV = [
  { href: "/", label: "Home", icon: IconHome },
  { href: "/today", label: "Command Center", icon: IconTarget },
  { href: "/chat", label: "Chat", icon: IconChat },
  { href: "/voice", label: "Voice", icon: IconMic },
  { href: "/projects", label: "Projects", icon: IconFolder },
  { href: "/design-review", label: "Design Review", icon: IconEye },
  { href: "/research", label: "Research", icon: IconSearch },
  { href: "/learning", label: "Learning", icon: IconSpark },
  { href: "/knowledge", label: "Knowledge", icon: IconBook },
  { href: "/goals", label: "Goals", icon: IconTarget },
  { href: "/memory", label: "Memory", icon: IconBrain },
  { href: "/settings", label: "Settings", icon: IconGear },
];

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  const pathname = usePathname();
  const { orbState, level, theme, setTheme } = useJarvis();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors ${
              active ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2/60 hover:text-text"
            }`}
            aria-current={active ? "page" : undefined}
          >
            <Icon />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2.5 px-2" onClick={() => setOpen(false)}>
      <Orb size={30} state={orbState} level={level} />
      <span className="text-[15px] font-semibold tracking-[0.18em]">JARVIS</span>
    </Link>
  );

  const footer = (
    <div className="mt-auto space-y-3 border-t border-border pt-4">
      <button
        className="btn btn-ghost w-full justify-start px-3 text-muted"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle light and dark mode"
      >
        {theme === "dark" ? <IconSun /> : <IconMoon />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
      <form action="/auth/signout" method="post" className="px-3">
        <p className="truncate text-xs text-faint">{email}</p>
        <button className="mt-1 text-xs text-muted underline-offset-2 hover:underline">Sign out</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col gap-6 border-r border-border bg-bg px-3 py-5 lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-3 backdrop-blur lg:hidden">
        {brand}
        <button className="btn btn-ghost p-2" onClick={() => setOpen(true)} aria-label="Open menu">
          <IconMenu />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col gap-6 bg-bg px-3 py-5 fade-up">
            <div className="flex items-center justify-between">
              {brand}
              <button className="btn btn-ghost p-2" onClick={() => setOpen(false)} aria-label="Close menu">
                <IconX />
              </button>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <main className="lg:pl-60">{children}</main>
      <FloatingOrb />
    </div>
  );
}
