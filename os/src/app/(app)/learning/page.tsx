"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

const STEPS = ["Concept", "Explanation", "Example", "Application", "Quiz", "Recall", "Mastery"];
const STARTERS = ["Unit economics", "Design systems", "Negotiation", "Product-market fit", "Typography scale", "Pricing strategy"];

export default function LearningPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const start = (t: string) =>
    router.push(
      `/chat?mode=teacher&q=${encodeURIComponent(`Start a learning session on "${t}". Teach me one concept at a time, connect it to my projects, and quiz me before moving on.`)}&send=1`,
    );
  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Teacher" title="Learning">
        No 400-page slogs. Pick a topic or attach a chapter in Chat, and JARVIS teaches it in small steps with active recall.
      </PageHeader>
      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="rounded-full border border-border px-2.5 py-1">{s}</span>
            {i < STEPS.length - 1 && <span className="text-faint">→</span>}
          </span>
        ))}
      </div>
      <form
        className="card mt-6 flex flex-col gap-2 p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim()) start(topic.trim());
        }}
      >
        <input className="input" placeholder="What do you want to learn?" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <button className="btn btn-primary shrink-0" disabled={!topic.trim()}>Start session</button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STARTERS.map((s) => (
          <button key={s} onClick={() => start(s)} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted hover:text-text">
            {s}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[13px] text-muted">
        Learning from a book or article? Open Chat, switch to <strong className="text-text">Teacher</strong>, attach the PDF (up to 4 MB) and ask JARVIS to teach it.
      </p>
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <ComingSoon title="Knowledge tracking & spaced repetition" phase="Phase 3">
          JARVIS will track concepts you&apos;ve learned, schedule reviews and surface weak areas.
        </ComingSoon>
        <ComingSoon title="Courses & progress" phase="Phase 7">
          Personalised multi-session courses with exercises and mastery scores.
        </ComingSoon>
      </div>
    </div>
  );
}
