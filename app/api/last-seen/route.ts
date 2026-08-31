import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { CacheKeys, TTL, redisGet, redisSet, redisDel } from "@/lib/redis/redis";

const toObjectId = (value: string): Types.ObjectId | null => {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
};

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
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

    const cacheKey = CacheKeys.lastSeenBatch(validIds);
    const cached = await redisGet<{ users: Record<string, { lastSeen: string | null; isOnlineNow: boolean }> }>(cacheKey);
    if (cached && typeof cached.users === "object") {
      return NextResponse.json(cached);
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

    for (const user of users as any[]) {
      const uid = String(user._id);
      const best =
        user.lastSeenAt || user.lastLoginAt || user.updatedAt || null;
      result[uid] = {
        lastSeen: best ? new Date(best).toISOString() : null,
        isOnlineNow: false,
      };
    }

    void redisSet(cacheKey, { users: result }, TTL.statuses);
    return NextResponse.json({ users: result });
  } catch (error: unknown) {
    console.error("GET /api/last-seen error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const rawUserId = String(body?.userId || "");
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
    await redisDel(CacheKeys.lastSeenSingle(rawUserId));

    return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() });
  } catch (error: unknown) {
    console.error("POST /api/last-seen error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
