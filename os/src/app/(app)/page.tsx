import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AskBox } from "@/components/AskBox";
import { LiveOrb } from "@/components/LiveOrb";
import { QuickActions } from "@/components/QuickActions";
import { MODES, isModeId } from "@/lib/jarvis/modes";
import type { Memory, Project } from "@/lib/jarvis/types";

export const dynamic = "force-dynamic";

function greeting() {
  // Server time is UTC; good enough for a greeting. The client-side Command Center uses local time.
  const h = new Date().getUTCHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: projects }, { data: conversations }, { data: goals }, { data: profile }] = await Promise.all([
    supabase.from("projects").select("*").eq("status", "active").order("updated_at", { ascending: false }).limit(4),
    supabase.from("conversations").select("id, title, mode, updated_at").order("updated_at", { ascending: false }).limit(5),
    supabase.from("memories").select("*").eq("category", "goals").order("importance", { ascending: false }).limit(3),
    supabase.from("profiles").select("display_name").maybeSingle(),
  ]);
  const name = (profile?.display_name as string) || "Adebayo";

  return (
    <div className="mx-auto max-w-5xl px-5 pt-10 pb-28 sm:px-8">
      <section className="flex flex-col items-center text-center">
        <LiveOrb size={168} />
        <h1 className="mt-6 text-[30px] font-semibold tracking-tight sm:text-[34px]">
          {greeting()}, {name}.
        </h1>
        <p className="mt-2 text-muted">What actually matters today?</p>
        <div className="mt-6 w-full max-w-2xl">
          <AskBox />
        </div>
      </section>

      <section className="mt-14">
        <h2 className="label mb-3">Quick actions</h2>
        <QuickActions />
      </section>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="label">Active projects</h2>
            <Link href="/projects" className="text-[12.5px] text-muted hover:text-text">All projects</Link>
          </div>
          <div className="space-y-2">
            {(projects as Project[] | null)?.length ? (
              (projects as Project[]).map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`} className="card block px-4 py-3 hover:border-border-strong">
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-0.5 line-clamp-1 text-[13px] text-muted">
                    {p.next_action ? `Next: ${p.next_action}` : "No next action set. Define one."}
                  </p>
                </Link>
              ))
            ) : (
              <Link href="/projects" className="card block px-4 py-4 text-sm text-muted hover:border-border-strong">
                No projects yet. Create WetinTech, VELOCITY or whatever you're building.
              </Link>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="label">Goals</h2>
            <Link href="/goals" className="text-[12.5px] text-muted hover:text-text">Edit goals</Link>
          </div>
          <div className="space-y-2">
            {(goals as Memory[] | null)?.length ? (
              (goals as Memory[]).map((g) => (
                <div key={g.id} className="card px-4 py-3 text-[14px]">{g.content}</div>
              ))
            ) : (
              <Link href="/goals" className="card block px-4 py-4 text-sm text-muted hover:border-border-strong">
                Tell JARVIS what you're aiming for so it can keep you honest.
              </Link>
            )}
          </div>
        </section>
      </div>

      {conversations && conversations.length > 0 && (
        <section className="mt-12">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="label">Recent conversations</h2>
            <Link href="/chat" className="text-[12.5px] text-muted hover:text-text">Open chat</Link>
          </div>
          <ul className="card divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id as string}>
                <Link href={`/chat?c=${c.id}`} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2/50">
                  <span className="truncate text-[14px]">{c.title as string}</span>
                  <span className="shrink-0 text-[12px] text-faint">{isModeId(c.mode) ? MODES[c.mode].label : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
