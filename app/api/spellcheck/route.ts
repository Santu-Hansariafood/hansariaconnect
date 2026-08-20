import { NextRequest, NextResponse } from "next/server";
import { correctSpelling } from "@/lib/spelling";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = typeof body?.text === "string" ? body.text : "";
    return NextResponse.json({ text: correctSpelling(text) });
  } catch {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
}