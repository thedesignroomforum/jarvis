"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUICK_ACTIONS, type QuickAction } from "@/lib/jarvis/quick-actions";

export function chatHref(action: QuickAction, extra = "") {
  const q = encodeURIComponent(action.prompt + extra);
  return `/chat?mode=${action.mode}&q=${q}&send=1`;
}

/** Quick-action buttons. Ones that need input open a small inline prompt first. */
export function QuickActions({ ids }: { ids?: string[] }) {
  const router = useRouter();
  const [active, setActive] = useState<QuickAction | null>(null);
  const [value, setValue] = useState("");
  const actions = ids ? QUICK_ACTIONS.filter((a) => ids.includes(a.id)) : QUICK_ACTIONS;

  const choose = (a: QuickAction) => {
    if (a.href) return router.push(a.href);
    if (a.needs === "topic" || a.needs === "text") {
      setActive(a);
      setValue("");
      return;
    }
    router.push(chatHref(a));
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => choose(a)}
            className={`card group px-4 py-3.5 text-left transition-colors hover:border-border-strong ${active?.id === a.id ? "border-border-strong" : ""}`}
          >
            <p className="text-[14px] font-medium">{a.label}</p>
            <p className="mt-0.5 text-[12.5px] text-muted">{a.hint}</p>
          </button>
        ))}
      </div>
      {active && (
        <form
          className="card fade-up mt-3 flex flex-col gap-2 p-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) router.push(chatHref(active, value.trim()));
          }}
        >
          <input
            autoFocus
            className="input"
            placeholder={active.needs === "topic" ? "Topic…" : "Describe it…"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => setActive(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={!value.trim()}>{active.label}</button>
          </div>
        </form>
      )}
    </div>
  );
}
