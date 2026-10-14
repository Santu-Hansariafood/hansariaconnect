import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import { getUserSession } from "@/lib/sessionAuth";
import { getUnreadCountsForUser } from "@/lib/socketEmitter";

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    await connectDB();

    const result = await getUnreadCountsForUser(normalizedId);
    if (!result) {
      return NextResponse.json(
        { error: "Unread counts could not be calculated" },
        { status: 500 },
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("GET /api/unread-counts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
