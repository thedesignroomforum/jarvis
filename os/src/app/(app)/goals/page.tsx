"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { IconTrash } from "@/components/icons";
import type { Memory } from "@/lib/jarvis/types";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Memory[] | null>(null);
  const [text, setText] = useState("");
  const [horizon, setHorizon] = useState("This quarter");

  const load = async () => {
    const r = await fetch("/api/memory");
    const all = r.ok ? ((await r.json()) as { memories: Memory[] }).memories : [];
    setGoals(all.filter((m) => m.category === "goals"));
  };
  useEffect(() => {
    load();
  }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "goals", content: `[${horizon}] ${text.trim()}`, importance: 4 }),
    });
    setText("");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Long-term objectives" title="Goals">
        Goals are part of JARVIS&apos;s memory, so every conversation is measured against them. Keep them few and specific.
      </PageHeader>
      <form onSubmit={add} className="card flex flex-col gap-2 p-3 sm:flex-row">
        <select className="input sm:w-40" value={horizon} onChange={(e) => setHorizon(e.target.value)} aria-label="Horizon">
          {["This month", "This quarter", "This year", "3–5 years", "Lifetime"].map((h) => <option key={h}>{h}</option>)}
        </select>
        <input className="input" placeholder="e.g. Launch WetinTech publishing with 100 weekly readers" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} />
        <button className="btn btn-primary shrink-0" disabled={!text.trim()}>Add goal</button>
      </form>

      <ul className="mt-6 space-y-2">
        {goals === null && <p className="text-sm text-muted">Loading…</p>}
        {goals?.length === 0 && <p className="text-sm text-muted">No goals yet.</p>}
        {goals?.map((g) => (
          <li key={g.id} className="card flex items-start gap-3 p-4">
            <p className="flex-1 text-[14.5px]">{g.content}</p>
            <button className="text-faint hover:text-danger" aria-label="Remove goal" onClick={async () => { await fetch(`/api/memory/${g.id}`, { method: "DELETE" }); load(); }}>
              <IconTrash className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>

      {goals && goals.length > 0 && (
        <Link
          href={`/chat?mode=coach&q=${encodeURIComponent("Review my goals against what I've actually been doing. Be honest: what's on track, what am I avoiding, and what should I drop?")}&send=1`}
          className="btn mt-6"
        >
          Review my progress with JARVIS
        </Link>
      )}
    </div>
  );
}
