import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { MEMORY_CATEGORIES } from "@/lib/jarvis/types";

const patchSchema = z
  .object({
    category: z.enum(MEMORY_CATEGORIES),
    content: z.string().trim().min(1).max(2000),
    importance: z.number().int().min(1).max(5),
    pinned: z.boolean(),
  })
  .partial();

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/memory/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });
  const { data, error } = await auth.supabase.from("memories").update(parsed.data).eq("id", id).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "update", entity: "memory", entity_id: id });
  return NextResponse.json({ memory: data });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/memory/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { error } = await auth.supabase.from("memories").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await auth.supabase.from("audit_log").insert({ user_id: auth.user.id, action: "delete", entity: "memory", entity_id: id });
  return NextResponse.json({ ok: true });
}
