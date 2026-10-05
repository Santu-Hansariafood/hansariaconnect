import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { apiError, requireUser } from "@/lib/api/request";

const toObjectId = (value: string): Types.ObjectId | null => {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

export const runtime = "nodejs";
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const rawUserIds = searchParams.get("ids");
    const singleId = searchParams.get("id");

    const ids: string[] = [];
    if (rawUserIds) {
      try {
        const parsed = JSON.parse(rawUserIds);
        if (Array.isArray(parsed)) {
          ids.push(...parsed.map(String).filter(Boolean));
        }
      } catch {
        rawUserIds.split(",").forEach((id) => {
          const trimmed = id.trim();
          if (trimmed) ids.push(trimmed);
        });
      }
    } else if (singleId) {
      ids.push(singleId);
    }

    const validIds = ids.filter((id) => Types.ObjectId.isValid(id));
    if (validIds.length === 0) {
      return NextResponse.json({ users: {} });
    }

    await connectDB();

    const users = await User.find({
      _id: { $in: validIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id lastLoginAt lastSeenAt updatedAt")
      .lean();

    const result: Record<string, { lastSeen: string | null; isOnlineNow: boolean }> = {};

    for (const id of validIds) {
      result[id] = {
        lastSeen: null,
        isOnlineNow: false,
      };
    }

    for (const user of users) {
      const uid = String(user._id);
      const best =
        user.lastSeenAt || user.lastLoginAt || user.updatedAt || null;
      const lastSeenDate = best ? new Date(best) : null;
      const isRecent = Boolean(
        lastSeenDate && Date.now() - lastSeenDate.getTime() <= SIX_HOURS_MS,
      );
      result[uid] = {
        lastSeen: lastSeenDate ? lastSeenDate.toISOString() : null,
        isOnlineNow: isRecent,
      };
    }

    return NextResponse.json({ users: result });
  } catch (error: unknown) {
    return apiError(error, "GET /api/last-seen");
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawUserId = String(session.id);
    const now = new Date();

    if (!rawUserId || !Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    await connectDB();

    const userId = toObjectId(rawUserId);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    await User.findByIdAndUpdate(userId, { $set: { lastSeenAt: now } }).catch(() => {});

    return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() });
  } catch (error: unknown) {
    return apiError(error, "POST /api/last-seen");
  }
}
