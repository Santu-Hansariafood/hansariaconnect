import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import AccessControl from "@/models/access/AccessControl";

const parseSession = (req: NextRequest) => {
  const raw = req.cookies.get("user_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed as { id: string };
  } catch {
    return null;
  }
};

export async function GET(req: NextRequest) {
  try {
    const session = parseSession(req);
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const doc = await AccessControl.findOne({ userId: session.id }).lean();
    const permissions = (doc as any)?.permissions || {
      contacts: true,
      groups: false,
      status: false,
      attachments: false,
    };
    return NextResponse.json({ permissions });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
