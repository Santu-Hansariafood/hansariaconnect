import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const profiles = await Profile.find();
    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 }
    );
  }
}
