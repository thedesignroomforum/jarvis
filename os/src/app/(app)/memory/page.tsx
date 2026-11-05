"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { useJarvis } from "@/components/JarvisProvider";
import { IconPin, IconTrash } from "@/components/icons";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, type Memory, type MemoryCategory } from "@/lib/jarvis/types";

export default function MemoryPage() {
  const { flash } = useJarvis();
  const [memories, setMemories] = useState<Memory[] | null>(null);
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newText, setNewText] = useState("");
  const [newCat, setNewCat] = useState<MemoryCategory>("identity");

  const load = async () => {
    const r = await fetch("/api/memory");
    setMemories(r.ok ? ((await r.json()) as { memories: Memory[] }).memories : []);
  };
  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const list = (memories ?? []).filter((m) => filter === "all" || m.category === filter);
    return MEMORY_CATEGORIES.map((c) => [c, list.filter((m) => m.category === c)] as const).filter(([, l]) => l.length);
  }, [memories, filter]);

  const patch = async (id: string, body: Partial<Memory>) => {
    const r = await fetch(`/api/memory/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (r.ok) {
      const { memory } = (await r.json()) as { memory: Memory };
      setMemories((ms) => ms?.map((m) => (m.id === id ? memory : m)) ?? null);
    } else flash("warning");
  };
  const forget = async (id: string) => {
    const r = await fetch(`/api/memory/${id}`, { method: "DELETE" });
    if (r.ok) setMemories((ms) => ms?.filter((m) => m.id !== id) ?? null);
  };
  const forgetAll = async () => {
    if (!confirm("Forget everything JARVIS knows about you? This permanently deletes all memories.")) return;
    const r = await fetch("/api/memory?confirm=all", { method: "DELETE" });
    if (r.ok) setMemories([]);
  };
  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await fetch("/api/memory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newText, category: newCat }) });
    if (r.ok) {
      setNewText("");
      flash("success");
      load();
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="You're in control" title="Memory">
        Everything JARVIS remembers about you, in plain text. It only stores what you choose to save. Edit, pin, or forget anything.
      </PageHeader>

      <form onSubmit={add} className="card flex flex-col gap-2 p-3 sm:flex-row">
        <select className="input sm:w-40" value={newCat} onChange={(e) => setNewCat(e.target.value as MemoryCategory)} aria-label="Category">
          {MEMORY_CATEGORIES.map((c) => <option key={c} value={c}>{MEMORY_CATEGORY_LABELS[c].label}</option>)}
        </select>
        <input className="input" placeholder="Something JARVIS should know…" value={newText} onChange={(e) => setNewText(e.target.value)} maxLength={2000} />
        <button className="btn btn-primary shrink-0" disabled={!newText.trim()}>Add</button>
      </form>
      <p className="mt-2 text-[12px] text-faint">Avoid storing sensitive details (health, finances, passwords) unless they genuinely help.</p>

      <div className="mt-6 flex gap-1.5 overflow-x-auto pb-1">
        {(["all", ...MEMORY_CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setFilter(c)} className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] ${filter === c ? "border-text bg-text text-bg" : "border-border text-muted hover:text-text"}`}>
            {c === "all" ? "All" : MEMORY_CATEGORY_LABELS[c].label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-8">
        {memories === null && <p className="text-sm text-muted">Loading…</p>}
        {memories?.length === 0 && <p className="text-sm text-muted">JARVIS doesn&apos;t remember anything yet. Add a fact above, or use “Remember” on any reply in Chat.</p>}
        {grouped.map(([cat, list]) => (
          <section key={cat}>
            <h2 className="label">{MEMORY_CATEGORY_LABELS[cat].label}</h2>
            <p className="text-[12px] text-faint">{MEMORY_CATEGORY_LABELS[cat].hint}</p>
            <ul className="mt-2 space-y-2">
              {list.map((m) => (
                <li key={m.id} className="card group p-3.5">
                  {editing === m.id ? (
                    <div>
                      <textarea className="input field-sizing-content" value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus />
                      <div className="mt-2 flex justify-end gap-2">
                        <button className="btn py-1.5" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="btn btn-primary py-1.5" onClick={async () => { await patch(m.id, { content: draft }); setEditing(null); }} disabled={!draft.trim()}>Save</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <p className="flex-1 text-[14px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                      <div className="flex shrink-0 items-center gap-0.5 text-muted">
                        <button onClick={() => patch(m.id, { pinned: !m.pinned })} className={`rounded-md p-1.5 hover:bg-surface-2 ${m.pinned ? "text-accent" : ""}`} aria-label={m.pinned ? "Unpin" : "Pin"} title="Pinned memories are always given to JARVIS first">
                          <IconPin className="h-4 w-4" />
                        </button>
                        <button onClick={() => { setEditing(m.id); setDraft(m.content); }} className="rounded-md px-2 py-1 text-[12px] hover:bg-surface-2">Edit</button>
                        <button onClick={() => forget(m.id)} className="rounded-md p-1.5 hover:bg-surface-2 hover:text-danger" aria-label="Forget this">
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-faint">
                    <span>Importance {m.importance}/5</span>
                    <span>{m.source === "chat" ? "Saved from chat" : "Added manually"}</span>
                    <span>{new Date(m.updated_at).toLocaleDateString()}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {memories && memories.length > 0 && (
        <button onClick={forgetAll} className="mt-12 text-[13px] text-danger hover:underline">Forget everything</button>
      )}
    </div>
  );
}
