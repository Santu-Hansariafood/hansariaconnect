import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Profile from "@/models/profile/Profile";

export const runtime = "nodejs";

interface SessionData {
  id: string;
}

const getSession = (req: NextRequest): SessionData | null => {
  const raw = req.cookies.get("user_session")?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
};

// ----------- GET PROFILE -----------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // 👈 FIX
    await connectDB();

    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await Profile.findOne({ userId: session.id });
    return NextResponse.json({ profile });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 }
    );
  }
}

// ----------- UPDATE or CREATE PROFILE -----------
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // 👈 FIX
    await connectDB();

    const session = getSession(req);
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
      { new: true, upsert: true }
    );

    return NextResponse.json({ profile: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 }
    );
  }
}

// ----------- DELETE PROFILE -----------
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params; // 👈 FIX
    await connectDB();

    const session = getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await Profile.findOneAndDelete({ userId: session.id });
    return NextResponse.json({ deleted: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Server Error" },
      { status: 500 }
    );
  }
}
