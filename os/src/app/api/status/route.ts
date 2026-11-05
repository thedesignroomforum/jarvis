import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

/** Which integrations are configured (booleans only, never secrets). */
export async function GET() {
  return NextResponse.json(integrationStatus());
}
