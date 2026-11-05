"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "./Markdown";
import { Orb } from "./Orb";
import { RememberDialog } from "./RememberDialog";
import { useJarvis } from "./JarvisProvider";
import { useSpeechInput } from "@/hooks/useSpeechInput";
import { useVoiceOutput } from "@/hooks/useVoiceOutput";
import { MODES, MODE_IDS, type ModeId } from "@/lib/jarvis/modes";
import { detectModeFromCommand } from "@/lib/jarvis/quick-actions";
import { fileToAttachment, captureScreenFrame } from "@/lib/attachments";
import type { Attachment, ChatMessage, ChatStreamEvent, Source } from "@/lib/jarvis/types";
import {
  IconBookmark, IconImage, IconMic, IconPaperclip, IconScreen, IconSend, IconSpeaker, IconStop, IconX,
} from "./icons";

export interface ChatProps {
  initialMode?: ModeId;
  conversationId?: string | null;
  projectId?: string | null;
  /** Prefill the composer; with autoSend it is sent immediately. */
  prefill?: string;
  autoSend?: boolean;
  /** Open the screen-capture picker on mount (from the floating orb). */
  autoCapture?: boolean;
  initialAttachments?: Attachment[];
  lockMode?: boolean;
  emptyState?: React.ReactNode;
  placeholder?: string;
  onConversationCreated?: (id: string) => void;
  className?: string;
}

let localId = 0;
const nextId = () => `local-${++localId}`;

export function Chat({
  initialMode = "normal",
  conversationId: initialConversationId = null,
  projectId = null,
  prefill = "",
  autoSend = false,
  autoCapture = false,
  initialAttachments = [],
  lockMode = false,
  emptyState,
  placeholder = "Talk to JARVIS…",
  onConversationCreated,
  className = "",
}: ChatProps) {
  const { setOrbState, flash, voiceReplies } = useJarvis();
  const voice = useVoiceOutput();
  const [mode, setMode] = useState<ModeId>(initialMode);
  const [conversationId, setConversationId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(prefill);
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [remember, setRemember] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(Boolean(initialConversationId));
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sentInitial = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechInput((text) => setInput((prev) => (prev ? `${prev} ${text}` : text)));

  // Load an existing conversation.
  useEffect(() => {
    if (!initialConversationId) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/conversations/${initialConversationId}`);
      if (!res.ok || cancelled) return setLoadingHistory(false);
      const data = (await res.json()) as { conversation: { mode: ModeId }; messages: ChatMessage[] };
      if (cancelled) return;
      setMessages(data.messages);
      if (!lockMode && data.conversation.mode) setMode(data.conversation.mode);
      setLoadingHistory(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [initialConversationId, lockMode]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (speech.listening) setOrbState("listening");
    else if (!streaming && !voice.speaking) setOrbState("idle");
  }, [speech.listening, streaming, voice.speaking, setOrbState]);

  const send = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? input).trim();
      if ((!text && attachments.length === 0) || streaming) return;
      voice.stop();

      let activeMode = mode;
      const detected = lockMode ? null : detectModeFromCommand(text);
      if (detected && detected !== mode) {
        activeMode = detected;
        setMode(detected);
      }

      const userMsg: ChatMessage = {
        id: nextId(),
        role: "user",
        content: text,
        attachments: attachments.map((a) => ({ kind: a.kind, name: a.name })),
      };
      const assistantId = nextId();
      setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "", mode: activeMode }]);
      setInput("");
      const sentAttachments = attachments;
      setAttachments([]);
      setError(null);
      setStreaming(true);
      setStatus("thinking");
      setOrbState("thinking");

      const ac = new AbortController();
      abortRef.current = ac;
      let full = "";
      let sources: Source[] = [];
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            conversationId,
            projectId,
            mode: activeMode,
            message: text,
            attachments: sentAttachments,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as ChatStreamEvent;
            if (ev.type === "meta") {
              if (!conversationId) {
                setConversationId(ev.conversationId);
                onConversationCreated?.(ev.conversationId);
              }
            } else if (ev.type === "status") {
              setStatus(ev.status);
            } else if (ev.type === "text") {
              full += ev.text;
              setStatus(null);
              setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, content: full } : msg)));
            } else if (ev.type === "sources") {
              sources = ev.sources;
              setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, sources } : msg)));
            } else if (ev.type === "error") {
              throw new Error(ev.message);
            } else if (ev.type === "done" && ev.messageId) {
              const realId = ev.messageId;
              setMessages((m) => m.map((msg) => (msg.id === assistantId ? { ...msg, id: realId } : msg)));
            }
          }
        }
        setOrbState("idle");
        if (voiceReplies && full) voice.speak(full);
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setOrbState("idle");
        } else {
          setError((e as Error).message);
          flash("warning", 2200);
          setMessages((m) => m.filter((msg) => !(msg.id === assistantId && !msg.content)));
        }
      } finally {
        setStreaming(false);
        setStatus(null);
        abortRef.current = null;
      }
    },
    [input, attachments, streaming, mode, lockMode, conversationId, projectId, onConversationCreated, setOrbState, flash, voice, voiceReplies],
  );

  // Auto-send a prefilled prompt once (quick actions, floating orb).
  useEffect(() => {
    if (autoSend && prefill && !sentInitial.current && !initialConversationId) {
      sentInitial.current = true;
      send(prefill);
    }
  }, [autoSend, prefill, initialConversationId, send]);

  const addFiles = async (files: FileList | File[]) => {
    setError(null);
    for (const f of Array.from(files)) {
      try {
        const a = await fileToAttachment(f);
        setAttachments((prev) => [...prev, a].slice(0, 4));
      } catch (e) {
        setError((e as Error).message);
      }
    }
  };

  const captureScreen = useCallback(async () => {
    setError(null);
    try {
      const a = await captureScreenFrame();
      if (a) {
        setAttachments((prev) => [...prev, a].slice(0, 4));
        if (!input) setInput("What does this screen communicate, and what should I improve?");
        textareaRef.current?.focus();
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [input]);

  const capturedOnce = useRef(false);
  useEffect(() => {
    if (autoCapture && !capturedOnce.current) {
      capturedOnce.current = true;
      // Browsers require a user gesture; the orb click usually counts. If not, the button is right there.
      captureScreen().catch(() => {});
    }
  }, [autoCapture, captureScreen]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      {!lockMode && (
        <div className="flex gap-1.5 overflow-x-auto pb-3 [scrollbar-width:none]">
          {MODE_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              title={MODES[id].description}
              className={`shrink-0 rounded-full border px-3 py-1 text-[12.5px] transition-colors ${
                mode === id ? "border-text bg-text text-bg" : "border-border text-muted hover:border-border-strong hover:text-text"
              }`}
            >
              {MODES[id].label}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {loadingHistory ? (
          <p className="py-10 text-center text-sm text-muted">Loading conversation…</p>
        ) : messages.length === 0 ? (
          emptyState ?? null
        ) : (
          <ol className="space-y-6 py-4">
            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              return (
                <li key={m.id} className="fade-up">
                  {m.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
                        {m.attachments && m.attachments.length > 0 && (
                          <div className="mb-1.5 flex flex-wrap gap-1.5">
                            {m.attachments.map((a, j) => (
                              <span key={j} className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted">
                                {a.kind === "image" ? "🖼" : "📄"} {a.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {m.content}
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        <Orb size={26} state={isLast && streaming ? "thinking" : "idle"} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {m.mode && m.mode !== "normal" && <p className="label mb-1">{MODES[m.mode]?.label}</p>}
                        {m.content ? (
                          <div className={isLast && streaming ? "caret" : ""}>
                            <Markdown>{m.content}</Markdown>
                          </div>
                        ) : (
                          <p className="text-sm text-muted">
                            {status === "searching" ? "Searching the web…" : status === "writing" ? "Writing…" : "Thinking…"}
                          </p>
                        )}
                        {m.sources && m.sources.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {m.sources.map((s) => (
                              <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="max-w-[240px] truncate rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted hover:text-text"
                                title={s.url}
                              >
                                {s.title || new URL(s.url).hostname}
                              </a>
                            ))}
                          </div>
                        )}
                        {m.content && !(isLast && streaming) && (
                          <div className="mt-2 flex gap-1 text-muted">
                            <button className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] hover:bg-surface-2 hover:text-text" onClick={() => setRemember(m.content)}>
                              <IconBookmark className="h-3.5 w-3.5" /> Remember
                            </button>
                            <button
                              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] hover:bg-surface-2 hover:text-text"
                              onClick={() => (voice.speaking ? voice.stop() : voice.speak(m.content))}
                            >
                              <IconSpeaker className="h-3.5 w-3.5" /> {voice.speaking ? "Stop" : "Listen"}
                            </button>
                            <button
                              className="rounded-lg px-2 py-1 text-[12px] hover:bg-surface-2 hover:text-text"
                              onClick={() => navigator.clipboard?.writeText(m.content)}
                            >
                              Copy
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {(error || voice.error || speech.error) && (
        <div className="mb-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-[13px] text-warn" role="alert">
          {error || voice.error || speech.error}
        </div>
      )}

      {/* Composer */}
      <div
        className="card mt-2 p-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2 pt-1 pb-2">
            {attachments.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 py-1 pr-1 pl-1">
                {a.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`data:${a.mediaType};base64,${a.data}`} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface text-[10px] text-muted uppercase">{a.kind}</span>
                )}
                <span className="max-w-[140px] truncate text-[12px]">{a.name}</span>
                <button
                  className="rounded-md p-1 text-muted hover:text-text"
                  onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${a.name}`}
                >
                  <IconX className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          value={speech.listening ? speech.interim || input : input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              addFiles(files);
            }
          }}
          rows={1}
          placeholder={speech.listening ? "Listening…" : placeholder}
          className="max-h-48 min-h-11 w-full resize-none bg-transparent px-3 py-2 text-[15px] outline-none placeholder:text-faint field-sizing-content"
          aria-label="Message JARVIS"
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-0.5 text-muted">
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,.md,.txt,.docx"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <button className="rounded-lg p-2 hover:bg-surface-2 hover:text-text" onClick={() => fileRef.current?.click()} title="Attach image, PDF or text" aria-label="Attach file">
              <IconPaperclip />
            </button>
            <button className="rounded-lg p-2 hover:bg-surface-2 hover:text-text" onClick={() => fileRef.current?.click()} title="Upload image" aria-label="Upload image">
              <IconImage />
            </button>
            <button className="rounded-lg p-2 hover:bg-surface-2 hover:text-text" onClick={captureScreen} title="Share a still of your screen (you choose what)" aria-label="Capture screen">
              <IconScreen />
            </button>
            <button
              className={`rounded-lg p-2 hover:bg-surface-2 hover:text-text ${speech.listening ? "text-accent" : ""}`}
              onClick={() => (speech.listening ? speech.stop() : speech.start())}
              title={speech.supported ? "Speak" : "Voice input not supported in this browser"}
              aria-label={speech.listening ? "Stop listening" : "Speak"}
              aria-pressed={speech.listening}
            >
              <IconMic />
            </button>
          </div>
          {streaming ? (
            <button className="btn h-9 px-3" onClick={() => abortRef.current?.abort()} aria-label="Stop">
              <IconStop className="h-4 w-4" /> Stop
            </button>
          ) : (
            <button
              className="btn btn-primary h-9 w-9 p-0"
              onClick={() => send()}
              disabled={!input.trim() && attachments.length === 0}
              aria-label="Send"
            >
              <IconSend className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 px-1 text-[11px] text-faint">
        {MODES[mode].label} mode · JARVIS can be wrong. Check important facts.
      </p>

      {remember !== null && <RememberDialog initial={remember} onClose={() => setRemember(null)} />}
    </div>
  );
}
