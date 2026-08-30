import { NextResponse } from "next/server";
import { checkKeys } from "@mcp-learning/shared/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await checkKeys("after_mcp", 2));
}
