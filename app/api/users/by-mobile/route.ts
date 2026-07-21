import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const mobileRaw = (body?.mobile || "").toString();
    const mobile = mobileRaw.replace(/\D/g, "");
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ error: "Invalid mobile" }, { status: 400 });
    }
    await connectDB();
    let user = await User.findOne({ mobile });
    if (!user) user = await User.create({ mobile });
    return NextResponse.json({ id: user._id.toString(), mobile });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
