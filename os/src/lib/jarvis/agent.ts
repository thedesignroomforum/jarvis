import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";
import { CORE_PERSONALITY } from "./personality";
import { MODES, type ModeId } from "./modes";
import { MEMORY_CATEGORY_LABELS, type Attachment, type Memory, type Project, type Source } from "./types";

/**
 * The JARVIS agent: builds the prompt (personality + mode + memory + context) and streams
 * a reply from Claude. All Claude calls go through here, server-side only.
 */

let client: Anthropic | null = null;
function getClient() {
  if (!serverEnv.anthropicKey) {
    throw new JarvisConfigError(
      "Claude is not configured. Add ANTHROPIC_API_KEY to your environment (see README → Claude API).",
    );
  }
  client ??= new Anthropic({ apiKey: serverEnv.anthropicKey });
  return client;
}

export class JarvisConfigError extends Error {}

// Server-side refusal fallback is supported on these models (Claude API only).
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function buildMemoryContext(memories: Memory[], project?: Project | null) {
  const lines: string[] = [];
  if (memories.length) {
    lines.push("# What JARVIS knows about Adebayo (saved memory; user-controlled, may be incomplete)");
    const byCat = new Map<string, Memory[]>();
    for (const m of memories) {
      const list = byCat.get(m.category) ?? [];
      list.push(m);
      byCat.set(m.category, list);
    }
    for (const [cat, list] of byCat) {
      lines.push(`## ${MEMORY_CATEGORY_LABELS[cat as keyof typeof MEMORY_CATEGORY_LABELS]?.label ?? cat}`);
      for (const m of list) lines.push(`- ${m.content}`);
    }
  }
  if (project) {
    lines.push(`\n# Current project workspace: ${project.name} (${project.status})`);
    if (project.vision) lines.push(`Vision: ${project.vision}`);
    if (project.next_action) lines.push(`Next action: ${project.next_action}`);
    for (const [k, v] of Object.entries(project.sections ?? {})) {
      if (v?.trim()) lines.push(`${k}: ${v.trim()}`);
    }
  }
  return lines.join("\n");
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

interface StreamArgs {
  mode: ModeId;
  history: HistoryTurn[];
  userText: string;
  attachments: Attachment[];
  memoryContext: string;
  now: Date;
  timezone?: string;
  voice?: boolean;
  onText: (t: string) => void;
  onStatus: (s: "thinking" | "searching" | "writing") => void;
}

export async function streamJarvisReply(args: StreamArgs): Promise<{ text: string; sources: Source[] }> {
  const anthropic = getClient();
  const mode = MODES[args.mode];
  const useWebSearch = serverEnv.webSearch && args.mode === "researcher";

  // System prompt: stable personality first (cached), then the per-request context.
  const dateLine = `Current date/time: ${args.now.toLocaleString("en-GB", {
    timeZone: args.timezone || "UTC",
    dateStyle: "full",
    timeStyle: "short",
  })} (${args.timezone || "UTC"}).`;
  const capabilities = [
    "Capabilities in this conversation:",
    "- You can see images and PDFs only when they are attached to a message.",
    useWebSearch
      ? "- Web search is ON: search, compare sources, and cite them."
      : "- Web search is OFF: you cannot browse. Say so if asked to research current facts.",
    "- You cannot see Adebayo's screen unless he shares a capture as an image.",
    "- You cannot set reminders, read calendars or send messages yet.",
    args.voice
      ? "- This is a VOICE conversation: reply in a natural spoken style, short (a few sentences), no markdown, tables, lists or code."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: CORE_PERSONALITY, cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: [`# Active mode: ${mode.label}\n${mode.brief}`, capabilities, args.memoryContext, dateLine]
        .filter(Boolean)
        .join("\n\n"),
    },
  ];

  // Current user turn: documents and images first, then the text.
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of args.attachments) {
    if (a.kind === "image") {
      content.push({
        type: "image",
        source: { type: "base64", media_type: a.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: a.data },
      });
    } else if (a.kind === "pdf") {
      content.push({
        type: "document",
        title: a.name,
        source: { type: "base64", media_type: "application/pdf", data: a.data },
      });
    } else {
      content.push({
        type: "document",
        title: a.name,
        source: { type: "text", media_type: "text/plain", data: a.data },
      });
    }
  }
  content.push({ type: "text", text: args.userText || "(see attachment)" });

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...args.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content },
  ];

  const tools: Anthropic.Beta.BetaToolUnion[] = useWebSearch
    ? [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }]
    : [];

  const useFallback = FALLBACK_MODELS.has(serverEnv.model);
  const stream = anthropic.beta.messages.stream({
    model: serverEnv.model,
    max_tokens: 32000,
    system,
    messages,
    thinking: { type: "adaptive" },
    output_config: { effort: serverEnv.effort },
    ...(tools.length ? { tools } : {}),
    ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
  });

  let text = "";
  const sources = new Map<string, Source>();
  args.onStatus("thinking");

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      const block = event.content_block;
      if (block.type === "server_tool_use") args.onStatus("searching");
      if (block.type === "text") args.onStatus("writing");
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) {
          if (r.type === "web_search_result") sources.set(r.url, { url: r.url, title: r.title });
        }
      }
    } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text;
      args.onText(event.delta.text);
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    const note = "\n\nI can't help with that request as phrased. Try rephrasing, or tell me more about what you're trying to achieve.";
    text += note;
    args.onText(note);
  } else if (final.stop_reason === "max_tokens") {
    const note = "\n\n_(Reply was cut off at the length limit. Ask me to continue.)_";
    text += note;
    args.onText(note);
  }

  // Prefer sources that were actually cited in the text.
  const cited = new Map<string, Source>();
  for (const block of final.content) {
    if (block.type === "text" && block.citations) {
      for (const c of block.citations) {
        if (c.type === "web_search_result_location") cited.set(c.url, { url: c.url, title: c.title ?? c.url });
      }
    }
  }
  const finalSources = [...(cited.size ? cited : sources).values()].slice(0, 12);
  return { text, sources: finalSources };
}

/** Short title for a new conversation, without a model call. */
export function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean || "New conversation";
}
