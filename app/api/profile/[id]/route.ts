import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";
import { getUserSession } from "@/lib/sessionAuth";

export const runtime = "nodejs";

const validateSession = async (req: NextRequest, id: string) => {
  const session = await getUserSession(req);
  if (!session?.id || session.id !== id) return null;
  return session;
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await connectDB();

    const session = await validateSession(req, id);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await Profile.findOne({ userId: session.id });
    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await connectDB();

    const session = await validateSession(req, id);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, about, photo, theme, notifications } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const updateData: any = { userId: session.id, name, about, photo };
    if (theme) updateData.theme = theme;
    if (notifications) updateData.notifications = notifications;

    const updated = await Profile.findOneAndUpdate(
      { userId: session.id },
      updateData,
      { new: true, upsert: true },
    );

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await connectDB();

    const session = await validateSession(req, id);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await Profile.findOneAndDelete({ userId: session.id });
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 },
    );
  }
}
