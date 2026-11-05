import { z } from "zod";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  vision: z.string().max(4000).default(""),
  next_action: z.string().max(1000).default(""),
  sections: z.record(z.string().max(60), z.string().max(8000)).default({}),
});

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const { data, error } = await auth.supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid project" }, { status: 400 });
  const { data, error } = await auth.supabase
    .from("projects")
    .insert({ ...parsed.data, user_id: auth.user.id })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ project: data }, { status: 201 });
}
