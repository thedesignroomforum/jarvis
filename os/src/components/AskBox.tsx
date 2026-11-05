"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconMic, IconSend } from "./icons";

export function AskBox({ placeholder = "Ask JARVIS anything…" }: { placeholder?: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  return (
    <form
      className="card flex items-center gap-2 p-2 pl-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim()) router.push(`/chat?q=${encodeURIComponent(text.trim())}&send=1`);
      }}
    >
      <input className="w-full bg-transparent py-2 text-[15px] outline-none placeholder:text-faint" placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-label="Ask JARVIS" />
      <button type="button" className="btn btn-ghost h-10 w-10 shrink-0 p-0 text-muted" onClick={() => router.push("/voice")} aria-label="Talk instead">
        <IconMic />
      </button>
      <button className="btn btn-primary h-10 w-10 shrink-0 p-0" disabled={!text.trim()} aria-label="Ask">
        <IconSend className="h-4 w-4" />
      </button>
    </form>
  );
}
