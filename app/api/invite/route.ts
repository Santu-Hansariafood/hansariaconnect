import { NextRequest, NextResponse } from "next/server";

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

    const name = typeof body.name === "string" ? body.name.trim() : "";

    const cleanedMobiles = body.mobiles
      .map((val) => String(val).replace(/\D/g, ""))
      .filter((num) => /^\d{10}$/.test(num));

    if (cleanedMobiles.length === 0) {
      return NextResponse.json({ error: "No valid mobile numbers provided" }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        invitedCount: cleanedMobiles.length,
        invitedMobiles: cleanedMobiles,
        name: name || null,
      },
      { status: 200 }
    );

  } catch (error: unknown) {
    const err = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: err }, { status: 500 });
  }
}
