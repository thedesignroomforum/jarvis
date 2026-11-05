"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";
import { QuickActions } from "@/components/QuickActions";
import { useJarvis } from "@/components/JarvisProvider";

interface FocusSession {
  id: string;
  task: string;
  expected_outcome: string;
  minutes: 25 | 45 | 60;
  started_at: string;
  ended_at: string | null;
  completed: boolean | null;
}

function greet() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function TodayPage() {
  const { flash } = useJarvis();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [task, setTask] = useState("");
  const [outcome, setOutcome] = useState("");
  const [minutes, setMinutes] = useState<25 | 45 | 60>(25);
  const [active, setActive] = useState<FocusSession | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [reflection, setReflection] = useState("");
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    const r = await fetch("/api/focus");
    if (!r.ok) return;
    const list = ((await r.json()) as { sessions: FocusSession[] }).sessions;
    setSessions(list);
    const open = list.find((s) => !s.ended_at);
    if (open) setActive(open);
  };
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (tick.current) clearInterval(tick.current);
    if (!active) return;
    const end = new Date(active.started_at).getTime() + active.minutes * 60_000;
    const update = () => setRemaining(Math.max(0, Math.round((end - Date.now()) / 1000)));
    update();
    tick.current = setInterval(update, 1000);
    return () => {
      if (tick.current) clearInterval(tick.current);
    };
  }, [active]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/focus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task, expected_outcome: outcome, minutes }) });
    if (r.ok) {
      setActive(((await r.json()) as { session: FocusSession }).session);
      setTask("");
      setOutcome("");
    }
  };
  const end = async (completed: boolean) => {
    if (!active) return;
    await fetch(`/api/focus/${active.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed, reflection }) });
    flash(completed ? "success" : "warning");
    setActive(null);
    setReflection("");
    load();
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const todays = sessions.filter((s) => new Date(s.started_at).toDateString() === new Date().toDateString());
  const done = todays.filter((s) => s.completed).length;

  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Daily Command Center" title={`${greet()}, Adebayo.`}>
        Several things are competing for your attention. Let&apos;s decide what actually matters today. Three priorities, maximum.
      </PageHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href={`/chat?mode=focus&q=${encodeURIComponent("Plan my day. Ask what's on my plate if you need to, then give me no more than three real priorities and the first action for each.")}&send=1`} className="card p-5 hover:border-border-strong">
          <p className="text-[15px] font-medium">Plan my day</p>
          <p className="mt-1 text-[13px] text-muted">JARVIS asks what&apos;s on your plate, then cuts it to what matters.</p>
        </Link>
        <Link href={`/chat?mode=coach&q=${encodeURIComponent("Daily check-in. Ask me how I'm actually doing today, one question at a time.")}&send=1`} className="card p-5 hover:border-border-strong">
          <p className="text-[15px] font-medium">Daily check-in</p>
          <p className="mt-1 text-[13px] text-muted">“How are you actually doing today?” Two minutes of honest reflection.</p>
        </Link>
      </div>

      <section id="focus" className="mt-10 scroll-mt-20">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="label">Focus mode</h2>
          <span className="text-[12px] text-faint">{done} completed today</span>
        </div>
        {active ? (
          <div className="card p-6 text-center">
            <p className="label">Do not start another task</p>
            <p className="mt-3 text-[18px] font-medium">{active.task}</p>
            {active.expected_outcome && <p className="mt-1 text-[13px] text-muted">Outcome: {active.expected_outcome}</p>}
            <p className="mt-6 font-mono text-[56px] font-light tabular-nums tracking-tight">{mm}:{ss}</p>
            {remaining === 0 && <p className="mt-2 text-[15px] font-medium">Time. What changed?</p>}
            <textarea className="input mx-auto mt-5 max-w-md" placeholder="What changed? (optional)" value={reflection} onChange={(e) => setReflection(e.target.value)} />
            <div className="mt-4 flex justify-center gap-2">
              <button className="btn" onClick={() => end(false)}>Didn&apos;t finish</button>
              <button className="btn btn-primary" onClick={() => end(true)}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={start} className="card space-y-3 p-5">
            <input className="input" placeholder="Task: one concrete thing (e.g. implement the article publishing state)" value={task} onChange={(e) => setTask(e.target.value)} required maxLength={500} />
            <input className="input" placeholder="Expected outcome: what exists when you're done?" value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={1000} />
            <div className="flex flex-wrap items-center gap-2">
              {([25, 45, 60] as const).map((m) => (
                <button type="button" key={m} onClick={() => setMinutes(m)} className={`rounded-full border px-4 py-1.5 text-[13px] ${minutes === m ? "border-text bg-text text-bg" : "border-border text-muted"}`}>
                  {m} min
                </button>
              ))}
              <button className="btn btn-primary ml-auto" disabled={!task.trim()}>Start focus</button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-10">
        <h2 className="label mb-3">Quick actions</h2>
        <QuickActions ids={["stuck", "decide", "ceo", "challenge"]} />
      </section>

      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <ComingSoon title="Tasks & calendar" phase="Phase 4">Upcoming events and unfinished tasks pulled into your morning brief.</ComingSoon>
        <ComingSoon title="Proactive briefings & reminders" phase="Phase 6">Morning summary, deadline nudges and “you&apos;ve been researching for two hours” prompts, with quiet hours you control.</ComingSoon>
      </div>
    </div>
  );
}
