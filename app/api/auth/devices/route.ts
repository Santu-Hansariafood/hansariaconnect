import { NextRequest, NextResponse } from "next/server";
import { getUserSession, removeUserSession } from "@/lib/sessionAuth";
import { disconnectUserSession } from "@/lib/socketEmitter";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getUserSession(req);
    if (!session?.id || !session.sessionId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = String(body?.sessionId || "");
    if (!/^[a-f0-9]{32}$/i.test(sessionId)) {
      return NextResponse.json(
        { error: "A valid linked device is required" },
        { status: 400 },
      );
    }
    if (sessionId === session.sessionId) {
      return NextResponse.json(
        { error: "You cannot remove the device you are currently using" },
        { status: 400 },
      );
    }

    const removed = await removeUserSession(session.id, sessionId);
    if (!removed) {
      return NextResponse.json(
        { error: "Linked device not found" },
        { status: 404 },
      );
    }
    await disconnectUserSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove linked device error:", error);
    return NextResponse.json(
      { error: "Could not remove the linked device" },
      { status: 500 },
    );
  }
}
