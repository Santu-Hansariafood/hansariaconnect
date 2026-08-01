import { NextRequest, NextResponse } from "next/server";
import { getUserSession, removeUserSession } from "@/lib/sessionAuth";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getUserSession(req);
    if (session?.id && session?.sessionId) {
      await removeUserSession(session.id, session.sessionId);
    }

    const response = NextResponse.json({ success: true });

    response.cookies.delete("user_session");
    response.cookies.delete("otp_session");

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
