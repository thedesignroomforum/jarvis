import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    auth.supabase.from("conversations").select("id, title, mode, project_id, updated_at").eq("id", id).maybeSingle(),
    auth.supabase
      .from("messages")
      .select("id, role, content, mode, attachments, sources, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ conversation, messages });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/conversations/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.supabase.from("conversations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "delete", entity: "conversation", entity_id: id });
  return NextResponse.json({ ok: true });
}
