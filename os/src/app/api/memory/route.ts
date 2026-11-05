import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { MEMORY_CATEGORIES } from "@/lib/jarvis/types";

const memoryInput = z.object({
  category: z.enum(MEMORY_CATEGORIES),
  content: z.string().trim().min(1).max(2000),
  importance: z.number().int().min(1).max(5).default(3),
  pinned: z.boolean().default(false),
  source: z.enum(["manual", "chat"]).default("manual"),
  project_id: z.uuid().nullish(),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from("memories")
    .select("*")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ memories: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = memoryInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid memory" }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("memories")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "create", entity: "memory", entity_id: data.id });
  return NextResponse.json({ memory: data }, { status: 201 });
}

/** "Forget everything": deletes all memories for the signed-in user. Requires confirm=all. */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  if (new URL(req.url).searchParams.get("confirm") !== "all") {
    return NextResponse.json({ error: "Pass ?confirm=all to delete every memory." }, { status: 400 });
  }
  const { error } = await auth.supabase.from("memories").delete().eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "delete_all", entity: "memory" });
  return NextResponse.json({ ok: true });
}
