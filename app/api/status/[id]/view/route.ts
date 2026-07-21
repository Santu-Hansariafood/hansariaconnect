import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Status from "@/models/status/Status";

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

const resolveParams = async (
  params: { id: string } | Promise<{ id: string }>,
) => {
  return params instanceof Promise ? await params : params;
};

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = parseSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = new Types.ObjectId(normalizedId);
    const { id } = await resolveParams(context.params);

    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid status id" }, { status: 400 });
    }

    await connectDB();

    const status = await Status.findById(id);
    if (!status) {
      return NextResponse.json({ error: "Status not found" }, { status: 404 });
    }

    if (status.expiresAt < new Date()) {
      return NextResponse.json({ error: "Status expired" }, { status: 400 });
    }

    if (!status.views.some((v: any) => String(v) === String(userId))) {
      status.views.push(userId);
      await status.save();
    }

    return NextResponse.json({ success: true, views: status.views.length });
  } catch (error: unknown) {
    console.error("POST /api/status/[id]/view error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
