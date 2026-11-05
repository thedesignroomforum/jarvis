"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import type { Project } from "@/lib/jarvis/types";

const TEMPLATES: Record<string, string[]> = {
  Product: ["Problem", "Users", "Features", "Research", "Competitors", "Brand", "Design", "Decisions", "Tasks", "Metrics", "Roadmap", "Open questions"],
  Venture: ["Market", "Competitors", "Business model", "Research", "Product", "Design", "Operations", "Licensing", "Roadmap"],
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<keyof typeof TEMPLATES>("Product");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then(async (r) => setProjects(r.ok ? ((await r.json()) as { projects: Project[] }).projects : []));
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const sections = Object.fromEntries(TEMPLATES[template].map((s) => [s, ""]));
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sections }),
    });
    setBusy(false);
    if (res.ok) router.push(`/projects/${((await res.json()) as { project: Project }).project.id}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Workspaces" title="Projects">
        Every project gets its own workspace: vision, problem, users, research, decisions, roadmap. JARVIS reads it when you chat inside the project.
      </PageHeader>

      <form onSubmit={create} className="card flex flex-col gap-2 p-3 sm:flex-row">
        <input className="input" placeholder="New project name, e.g. WetinTech" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
        <select className="input sm:w-40" value={template} onChange={(e) => setTemplate(e.target.value as keyof typeof TEMPLATES)} aria-label="Template">
          {Object.keys(TEMPLATES).map((t) => <option key={t}>{t}</option>)}
        </select>
        <button className="btn btn-primary shrink-0" disabled={busy || !name.trim()}>Create</button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {projects === null && <p className="text-sm text-muted">Loading…</p>}
        {projects?.length === 0 && <p className="text-sm text-muted">No projects yet.</p>}
        {projects?.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card block p-4 hover:border-border-strong">
            <div className="flex items-center justify-between">
              <p className="font-medium">{p.name}</p>
              <span className="text-[11px] text-faint uppercase">{p.status}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-[13px] text-muted">{p.vision || "No vision written yet."}</p>
            {p.next_action && <p className="mt-2 text-[12.5px]"><span className="text-faint">Next · </span>{p.next_action}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
