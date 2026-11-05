"use client";

import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PROJECT_SECTION_PRESETS, type Project } from "@/lib/jarvis/types";
import { IconChat, IconPlus, IconTrash } from "@/components/icons";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([]);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [newSection, setNewSection] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(async (r) => {
      if (!r.ok) return router.push("/projects");
      const data = (await r.json()) as { project: Project; conversations: { id: string; title: string }[] };
      setProject(data.project);
      setConversations(data.conversations ?? []);
    });
  }, [id, router]);

  // Autosave, debounced.
  const update = (patch: Partial<Project>) => {
    setProject((p) => (p ? { ...p, ...patch } : p));
    setSaved("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      setSaved("saved");
    }, 600);
  };

  if (!project) return <p className="p-10 text-sm text-muted">Loading…</p>;

  const setSection = (k: string, v: string) => update({ sections: { ...project.sections, [k]: v } });
  const removeSection = (k: string) => {
    const rest = { ...project.sections };
    delete rest[k];
    update({ sections: rest });
  };
  const suggestions = PROJECT_SECTION_PRESETS.filter((s) => !(s in project.sections));

  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/projects" className="text-[13px] text-muted hover:text-text">← Projects</Link>
        <span className="text-[12px] text-faint">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : ""}</span>
      </div>
      <input
        className="mt-4 w-full bg-transparent text-[30px] font-semibold tracking-tight outline-none"
        value={project.name}
        onChange={(e) => update({ name: e.target.value })}
        aria-label="Project name"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-[13px]" value={project.status} onChange={(e) => update({ status: e.target.value as Project["status"] })} aria-label="Status">
          {["active", "paused", "done", "archived"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <Link href={`/chat?project=${project.id}&q=${encodeURIComponent(`Look at the ${project.name} workspace. What's the most important thing to do next, and what am I avoiding?`)}&send=1`} className="btn py-1.5 text-[13px]">
          <IconChat className="h-4 w-4" /> Ask JARVIS about this project
        </Link>
      </div>

      <div className="mt-8 space-y-5">
        <Field label="Vision" value={project.vision} onChange={(v) => update({ vision: v })} placeholder="What does this become if it works?" />
        <Field label="Next action" value={project.next_action} onChange={(v) => update({ next_action: v })} placeholder="One concrete action. Not 'work on it'." rows={2} />
        {Object.entries(project.sections).map(([k, v]) => (
          <Field key={k} label={k} value={v} onChange={(val) => setSection(k, val)} onRemove={() => removeSection(k)} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-1.5">
        {suggestions.slice(0, 8).map((s) => (
          <button key={s} className="rounded-full border border-dashed border-border-strong px-2.5 py-1 text-[12px] text-muted hover:text-text" onClick={() => setSection(s, "")}>
            + {s}
          </button>
        ))}
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (newSection.trim()) setSection(newSection.trim().slice(0, 60), "");
            setNewSection("");
          }}
        >
          <input className="input w-36 py-1 text-[12px]" placeholder="Custom section" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
          <button className="rounded-md p-1 text-muted hover:text-text" aria-label="Add section"><IconPlus className="h-4 w-4" /></button>
        </form>
      </div>

      {conversations.length > 0 && (
        <section className="mt-10">
          <h2 className="label mb-2">Conversations in this project</h2>
          <ul className="card divide-y divide-border">
            {conversations.map((c) => (
              <li key={c.id}><Link href={`/chat?c=${c.id}`} className="block px-4 py-2.5 text-[14px] hover:bg-surface-2/50">{c.title}</Link></li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="mt-12 text-[13px] text-danger hover:underline"
        onClick={async () => {
          if (!confirm(`Delete ${project.name}? Its conversations are kept but unlinked.`)) return;
          await fetch(`/api/projects/${id}`, { method: "DELETE" });
          router.push("/projects");
        }}
      >
        Delete project
      </button>
    </div>
  );
}

function Field({ label, value, onChange, onRemove, placeholder, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; onRemove?: () => void; placeholder?: string; rows?: number }) {
  return (
    <label className="group block">
      <div className="mb-1 flex items-center justify-between">
        <span className="label">{label}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="invisible text-faint group-hover:visible hover:text-danger" aria-label={`Remove ${label}`}>
            <IconTrash className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <textarea className="input field-sizing-content min-h-12" rows={rows} value={value} placeholder={placeholder ?? `Write about ${label.toLowerCase()}…`} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
