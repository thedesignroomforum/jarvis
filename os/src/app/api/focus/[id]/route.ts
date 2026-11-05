import { z } from "zod";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";

const endSchema = z.object({ completed: z.boolean(), reflection: z.string().max(2000).default("") });

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/focus/[id]">) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = endSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("focus_sessions")
    .update({ ...parsed.data, ended_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data });
}
