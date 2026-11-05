import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailAllowed } from "@/lib/env";

/**
 * Authorization for API routes: a signed-in user whose email is on the allow-list.
 * Returns either { supabase, user } or a ready-made error response.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) } as const;
  }
  if (!isEmailAllowed(user.email)) {
    return { error: NextResponse.json({ error: "This account is not allowed to use JARVIS." }, { status: 403 }) } as const;
  }
  return { supabase, user } as const;
}
