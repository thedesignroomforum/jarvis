"use client";

import { useState } from "react";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS, type MemoryCategory } from "@/lib/jarvis/types";
import { useJarvis } from "./JarvisProvider";

/** Lets the user decide exactly what JARVIS stores. Nothing is saved without this step. */
export function RememberDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { flash } = useJarvis();
  const [content, setContent] = useState(initial.slice(0, 2000));
  const [category, setCategory] = useState<MemoryCategory>("projects");
  const [importance, setImportance] = useState(3);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, category, importance, source: "chat" }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Couldn't save that memory.");
      flash("warning");
      return;
    }
    flash("success");
    onSaved?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="card fade-up w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Save to memory">
        <h2 className="text-[17px] font-semibold">Save to memory</h2>
        <p className="mt-1 text-sm text-muted">Edit it down to the fact worth keeping. You can change or delete it any time in Memory.</p>
        <textarea className="input mt-4 min-h-32" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Category</span>
            <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value as MemoryCategory)}>
              {MEMORY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {MEMORY_CATEGORY_LABELS[c].label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Importance</span>
            <select className="input mt-1" value={importance} onChange={(e) => setImportance(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 5 ? "· critical" : n === 1 ? "· minor" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !content.trim()}>
            {saving ? "Saving…" : "Remember"}
          </button>
        </div>
      </div>
    </div>
  );
}
