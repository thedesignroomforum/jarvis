import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { buildMemoryContext, JarvisConfigError, streamJarvisReply, titleFrom } from "@/lib/jarvis/agent";
import { MODE_IDS } from "@/lib/jarvis/modes";
import type { ChatStreamEvent, Memory, Project } from "@/lib/jarvis/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_IMAGE_B64 = 7_000_000; // ~5 MB binary
const MAX_PDF_B64 = 6_000_000; // ~4.5 MB binary (Vercel request body limit is 4.5 MB)
const MAX_TEXT = 400_000;

const attachmentSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    name: z.string().max(200),
    mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    data: z.string().max(MAX_IMAGE_B64),
  }),
  z.object({
    kind: z.literal("pdf"),
    name: z.string().max(200),
    mediaType: z.literal("application/pdf"),
    data: z.string().max(MAX_PDF_B64),
  }),
  z.object({
    kind: z.literal("text"),
    name: z.string().max(200),
    mediaType: z.string().max(100),
    data: z.string().max(MAX_TEXT),
  }),
]);

const bodySchema = z.object({
  conversationId: z.uuid().nullish(),
  projectId: z.uuid().nullish(),
  mode: z.enum(MODE_IDS),
  message: z.string().max(20_000),
  attachments: z.array(attachmentSchema).max(4).default([]),
  timezone: z.string().max(64).optional(),
  voice: z.boolean().optional(),
});

const HISTORY_LIMIT = 30;

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { supabase, user } = auth;

  const limited = rateLimit(`chat:${user.id}`);
  if (!limited.ok) {
    return NextResponse.json(
      { error: `Slow down a little. Try again in ${limited.retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: z.treeifyError(parsed.error) }, { status: 400 });
  }
  const body = parsed.data;
  if (!body.message.trim() && body.attachments.length === 0) {
    return NextResponse.json({ error: "Say something or attach a file." }, { status: 400 });
  }

  // Conversation: reuse (RLS guarantees ownership) or create.
  let conversationId = body.conversationId ?? null;
  if (conversationId) {
    const { data } = await supabase.from("conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!data) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    await supabase.from("conversations").update({ mode: body.mode }).eq("id", conversationId);
  } else {
    const { data, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: titleFrom(body.message || body.attachments[0]?.name || "New conversation"),
        mode: body.mode,
        project_id: body.projectId ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return NextResponse.json({ error: "Could not create conversation" }, { status: 500 });
    conversationId = data.id as string;
  }

  // Context: recent history, memories, linked project.
  const [{ data: historyRows }, { data: memoryRows }, { data: conv }] = await Promise.all([
    supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT),
    supabase
      .from("memories")
      .select("*")
      .order("pinned", { ascending: false })
      .order("importance", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase.from("conversations").select("project_id").eq("id", conversationId).single(),
  ]);
  let project: Project | null = null;
  const projectId = body.projectId ?? conv?.project_id ?? null;
  if (projectId) {
    const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
    project = (data as Project) ?? null;
  }

  // History must alternate and start with a user turn.
  const history = (historyRows ?? []).reverse() as { role: "user" | "assistant"; content: string }[];
  while (history.length && history[0].role !== "user") history.shift();

  const attachmentMeta = body.attachments.map((a) => ({ kind: a.kind, name: a.name }));
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    user_id: user.id,
    role: "user",
    content: body.message,
    mode: body.mode,
    attachments: attachmentMeta,
  });

  const encoder = new TextEncoder();
  const convId = conversationId;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: ChatStreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      send({ type: "meta", conversationId: convId, mode: body.mode });
      try {
        const historyWithNotes = history.map((h) => ({ role: h.role, content: h.content || "(attachment only)" }));
        const { text, sources } = await streamJarvisReply({
          mode: body.mode,
          history: historyWithNotes,
          userText: body.message,
          attachments: body.attachments,
          memoryContext: buildMemoryContext((memoryRows ?? []) as Memory[], project),
          now: new Date(),
          timezone: body.timezone,
          voice: body.voice ?? false,
          onText: (t) => send({ type: "text", text: t }),
          onStatus: (s) => send({ type: "status", status: s }),
        });
        if (sources.length) send({ type: "sources", sources });
        const { data: saved } = await supabase
          .from("messages")
          .insert({
            conversation_id: convId,
            user_id: user.id,
            role: "assistant",
            content: text,
            mode: body.mode,
            sources,
          })
          .select("id")
          .single();
        await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId);
        send({ type: "done", messageId: (saved?.id as string) ?? null });
      } catch (err) {
        const message =
          err instanceof JarvisConfigError
            ? err.message
            : err instanceof Error
              ? `JARVIS hit an error talking to Claude: ${err.message}`
              : "Unknown error";
        console.error("[chat]", err);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
