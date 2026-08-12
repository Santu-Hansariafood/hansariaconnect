import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Status from "@/models/status/Status";
import Contact from "@/models/contact/Contact";
import { getUserSession } from "@/lib/sessionAuth";

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = new Types.ObjectId(normalizedId);
    await connectDB();

    const myContacts = await Contact.find({ userId }).lean();
    const contactMobiles = new Set<string>();
    myContacts.forEach((c) => {
      const contact = c as { mobiles?: string[] };
      if (Array.isArray(contact.mobiles)) {
        contact.mobiles.forEach((m: string) => contactMobiles.add(m));
      }
    });

    const User = (await import("@/models/user/User")).default;
    const Profile = (await import("@/models/profile/Profile")).default;

    const contactUsers = contactMobiles.size
      ? await User.find({ mobile: { $in: Array.from(contactMobiles) } }).lean()
      : [];

    const contactUserIds = contactUsers.map((u: any) => u._id);

    const statuses = await Status.find({
      userId: { $in: contactUserIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("userId", "mobile")
      .sort({ createdAt: -1 })
      .lean();

    const statusMap: Record<string, any[]> = {};
    for (const status of statuses) {
      const uid = String((status as any).userId?._id || status.userId);
      if (!statusMap[uid]) {
        statusMap[uid] = [];
      }
      const profile = await Profile.findOne({ userId: uid }).lean();
      statusMap[uid].push({
        id: String(status._id),
        userId: uid,
        name:
          (profile as any)?.name || (status as any).userId?.mobile || "User",
        avatar: (profile as any)?.photo || "",
        media: status.media,
        type: status.type,
        views: (status.views || []).length,
        hasViewed: (status.views || []).some(
          (v: any) => String(v) === String(userId),
        ),
        timestamp: status.createdAt,
        expiresAt: status.expiresAt,
      });
    }

    return NextResponse.json({ statuses: statusMap });
  } catch (error: unknown) {
    console.error("GET /api/status error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const userId = new Types.ObjectId(normalizedId);
    const body = await req.json();
    const { media, type } = body;

    if (!media || !type || !["image", "video"].includes(type)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    await connectDB();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const status = await Status.create({
      userId,
      media,
      type,
      views: [],
      expiresAt,
    });

    return NextResponse.json(
      { status: { id: String(status._id), ...status.toObject() } },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("POST /api/status error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
