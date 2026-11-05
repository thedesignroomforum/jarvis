import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const startSchema = z.object({
  task: z.string().trim().min(1).max(500),
  expected_outcome: z.string().max(1000).default(""),
  minutes: z.union([z.literal(25), z.literal(45), z.literal(60)]),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase
    .from("focus_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sessions: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = startSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("focus_sessions")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ session: data }, { status: 201 });
}
