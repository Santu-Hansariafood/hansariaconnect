import { NextRequest, NextResponse } from "next/server";

import { connectDB } from "@/lib/db/db";
import { apiError } from "@/lib/api/request";
import { getUserSession } from "@/lib/sessionAuth";
import User from "@/models/user/User";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const configured = Boolean(
      process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET &&
        process.env.GOOGLE_REDIRECT_URI,
    );
    if (!configured) {
      return NextResponse.json({ configured: false, connected: false });
    }

    await connectDB();
    const user = await User.findById(session.id)
      .select("googleAccessToken googleRefreshToken")
      .lean<{
        googleAccessToken?: string;
        googleRefreshToken?: string;
      } | null>();

    return NextResponse.json({
      configured,
      connected: Boolean(user?.googleAccessToken || user?.googleRefreshToken),
    });
  } catch (error) {
    return apiError(error, "GET /api/google/contacts/status");
  }
}
