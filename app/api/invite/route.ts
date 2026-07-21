import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";

interface InviteRequestBody {
  mobiles: Array<string | number>;
  name?: string;
}

interface SessionCookie {
  id: string;
  [key: string]: unknown;
}

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: SessionCookie;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: InviteRequestBody = await req.json().catch(() => null);

    if (!body || !Array.isArray(body.mobiles)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    await connectDB();

    // Get sender's info
    const user = await User.findById(session.id);
    const profile = await Profile.findOne({ userId: session.id });
    const senderName = profile?.name || user?.name || "Someone";
    const senderMobile = user?.mobile || "";

    const cleanedMobiles = body.mobiles
      .map((val) => String(val).replace(/\D/g, ""))
      .filter((num) => /^\d{10}$/.test(num));

    if (cleanedMobiles.length === 0) {
      return NextResponse.json({ error: "No valid mobile numbers provided" }, { status: 400 });
    }

    // Build SMS text with sender's info
    const origin = process.env.NEXTAUTH_URL || "https://hansariaconnect.com";
    const loginUrl = `${origin}/login`;
    const smsText = `Hi, ${senderName}${senderMobile ? ` (+91${senderMobile})` : ""} has invited you to join HansariaConnect! Login here: ${loginUrl}`;

    return NextResponse.json(
      {
        success: true,
        invitedCount: cleanedMobiles.length,
        invitedMobiles: cleanedMobiles,
        smsText,
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
