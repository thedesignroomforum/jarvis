"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";
import { useJarvis } from "@/components/JarvisProvider";
import type { IntegrationStatus } from "@/lib/env";

export default function SettingsPage() {
  const { theme, setTheme, voiceReplies, setVoiceReplies } = useJarvis();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  useEffect(() => {
    fetch("/api/status").then(async (r) => setStatus((await r.json()) as IntegrationStatus));
  }, []);

  const rows: { name: string; ok: boolean | undefined; detail: string; fix: string }[] = [
    { name: "Claude", ok: status?.claude, detail: status ? `Model: ${status.model}` : "", fix: "Set ANTHROPIC_API_KEY" },
    { name: "Supabase", ok: status?.supabase, detail: "Auth, database, memory", fix: "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY" },
    { name: "ElevenLabs voice", ok: status?.elevenlabs, detail: "Text-to-speech (free plan works)", fix: "Set ELEVENLABS_API_KEY" },
    { name: "Web search", ok: status?.webSearch, detail: "Live research with sources", fix: "Set JARVIS_WEB_SEARCH=true and enable web search in the Anthropic Console" },
    { name: "Email allow-list", ok: status?.allowList, detail: "Only your email can sign in", fix: "Set JARVIS_ALLOWED_EMAILS" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Preferences" title="Settings" />

      <section>
        <h2 className="label mb-3">Appearance & voice</h2>
        <div className="card divide-y divide-border">
          <Toggle label="Dark mode" hint="Light mode is available for daytime work." checked={theme === "dark"} onChange={(v) => setTheme(v ? "dark" : "light")} />
          <Toggle
            label="Speak replies in Chat"
            hint="Uses ElevenLabs credits. On the free plan, replies are trimmed for voice so credits last."
            checked={voiceReplies}
            onChange={setVoiceReplies}
            disabled={status ? !status.elevenlabs : true}
          />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="label mb-3">Integrations</h2>
        <ul className="card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.name} className="flex items-start justify-between gap-4 p-4">
              <div>
                <p className="text-[14.5px] font-medium">{r.name}</p>
                <p className="text-[12.5px] text-muted">{r.ok ? r.detail : r.fix}</p>
              </div>
              <span className={`shrink-0 text-[13px] ${r.ok ? "text-ok" : "text-muted"}`}>{status === null ? "…" : r.ok ? "Connected" : "Not configured"}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-faint">API keys live only on the server (environment variables). They are never sent to your browser.</p>
      </section>

      <section className="mt-10">
        <h2 className="label mb-3">Privacy</h2>
        <div className="card space-y-2 p-4 text-[13.5px] leading-relaxed text-muted">
          <p>JARVIS only remembers what you save. Manage it in Memory, including “Forget everything”.</p>
          <p>The microphone is used only while you hold a voice session open. Screen capture takes one still image after you choose a screen, then stops. Nothing is recorded in the background.</p>
          <p>Attached files are sent to Claude for that message and are not stored. Conversation text is stored in your Supabase database, protected by row-level security.</p>
        </div>
      </section>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <ComingSoon title="Proactive JARVIS" phase="Phase 6">Choose what JARVIS may monitor, notification frequency and quiet hours.</ComingSoon>
        <ComingSoon title="Connected services" phase="Phase 4">Calendar and task tools, connected only with your permission.</ComingSoon>
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange, disabled }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 p-4 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <span>
        <span className="block text-[14.5px] font-medium">{label}</span>
        <span className="block text-[12.5px] text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-text" : "bg-surface-2 border border-border-strong"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg shadow transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
