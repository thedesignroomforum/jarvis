import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    status: z.enum(["active", "paused", "done", "archived"]),
    vision: z.string().max(4000),
    next_action: z.string().max(1000),
    sections: z.record(z.string().max(60), z.string().max(8000)),
  })
  .partial();

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const [{ data: project }, { data: conversations }] = await Promise.all([
    auth.supabase.from("projects").select("*").eq("id", id).maybeSingle(),
    auth.supabase
      .from("conversations")
      .select("id, title, mode, updated_at")
      .eq("project_id", id)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project, conversations });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const { data, error } = await auth.supabase.from("projects").update(parsed.data).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.supabase.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "delete", entity: "project", entity_id: id });
  return NextResponse.json({ ok: true });
}
