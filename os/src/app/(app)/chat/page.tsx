"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chat } from "@/components/Chat";
import { LiveOrb } from "@/components/LiveOrb";
import { IconPlus, IconTrash } from "@/components/icons";
import { isModeId, MODES } from "@/lib/jarvis/modes";
import { COMMAND_EXAMPLES } from "@/lib/jarvis/quick-actions";
import type { Conversation } from "@/lib/jarvis/types";

function ChatScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const c = params.get("c");
  const modeParam = params.get("mode");
  const q = params.get("q") ?? "";
  const send = params.get("send") === "1";
  const capture = params.get("capture") === "1";
  const project = params.get("project");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [chatKey, setChatKey] = useState(() => c ?? `new-${q}-${modeParam}`);

  const load = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConversations(((await res.json()) as { conversations: Conversation[] }).conversations);
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (c) setChatKey(c);
    else setChatKey(`new-${q}-${modeParam}-${Date.now()}`);
  }, [c, q, modeParam]);

  const remove = async (id: string) => {
    if (!confirm("Delete this conversation? This can't be undone.")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (id === c) router.push("/chat");
    load();
  };

  return (
    <div className="flex h-[calc(100dvh-57px)] lg:h-dvh">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border p-3 md:flex">
        <Link href="/chat" className="btn w-full">
          <IconPlus className="h-4 w-4" /> New conversation
        </Link>
        <ul className="mt-4 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {conversations.map((conv) => (
            <li key={conv.id} className="group flex items-center">
              <Link
                href={`/chat?c=${conv.id}`}
                className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-[13px] ${conv.id === c ? "bg-surface-2 text-text" : "text-muted hover:bg-surface-2/60 hover:text-text"}`}
              >
                <span className="block truncate">{conv.title}</span>
                <span className="block text-[11px] text-faint">{isModeId(conv.mode) ? MODES[conv.mode].label : ""}</span>
              </Link>
              <button className="invisible rounded-md p-1.5 text-faint group-hover:visible hover:text-danger" onClick={() => remove(conv.id)} aria-label="Delete conversation">
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-24 sm:px-6">
        <Chat
          key={chatKey}
          className="h-full"
          conversationId={c}
          projectId={project}
          initialMode={isModeId(modeParam) ? modeParam : "normal"}
          prefill={q}
          autoSend={send}
          autoCapture={capture}
          onConversationCreated={(id) => {
            window.history.replaceState(null, "", `/chat?c=${id}`);
            load();
          }}
          emptyState={
            <div className="flex h-full flex-col items-center justify-center py-10 text-center">
              <LiveOrb size={110} />
              <p className="mt-5 text-[17px] font-medium">How can I make you sharper today?</p>
              <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                {COMMAND_EXAMPLES.map((ex) => (
                  <Link key={ex} href={`/chat?q=${encodeURIComponent(ex)}&send=1`} className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-muted hover:border-border-strong hover:text-text">
                    {ex}
                  </Link>
                ))}
              </div>
            </div>
          }
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatScreen />
    </Suspense>
  );
}
