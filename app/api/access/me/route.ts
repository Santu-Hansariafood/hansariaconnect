import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import AccessControl from "@/models/access/AccessControl";

import { getUserSession } from "@/lib/sessionAuth";

const parseSession = async (req: NextRequest) => {
  return await getUserSession(req);
};

export async function GET(req: NextRequest) {
  try {
    const session = await parseSession(req);
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
