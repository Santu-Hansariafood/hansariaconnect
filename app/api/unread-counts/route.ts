import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";
import { CacheKeys, TTL, redisGet, redisSet } from "@/lib/redis/redis";

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

    const cacheKey = `unread:${normalizedId}`;
    const cached = await redisGet<{
      conversations: Record<string, number>;
      groups: Record<string, number>;
      total: number;
    }>(cacheKey);
    if (cached && typeof cached === "object") {
      return NextResponse.json(cached);
    }

    const userId = new Types.ObjectId(normalizedId);
    await connectDB();

    const conversations = await Conversation.find({
      $or: [{ userA: userId }, { userB: userId }],
    }).lean();

    const groups = await Group.find({
      "members.userId": userId,
    }).lean();

    const conversationCounts: Record<string, number> = {};
    const groupCounts: Record<string, number> = {};

    for (const conv of conversations) {
      const peerId =
        String(conv.userA) === String(userId) ? conv.userB : conv.userA;

      const receipt = (await ReadReceipt.findOne({
        userId,
        conversationId: conv._id,
      }).lean()) as any;

      const lastReadAt =
        (receipt && typeof receipt === "object" && "readAt" in receipt
          ? receipt.readAt
          : null) || new Date(0);

      const unreadCount = await Message.countDocuments({
        from: new Types.ObjectId(peerId),
        to: userId,
        createdAt: { $gt: lastReadAt },
      });

      if (unreadCount > 0) {
        conversationCounts[String(peerId)] = unreadCount;
      }
    }

    for (const group of groups) {
      const receipt = (await ReadReceipt.findOne({
        userId,
        groupId: group._id,
      }).lean()) as any;

      const lastReadAt =
        (receipt && typeof receipt === "object" && "readAt" in receipt
          ? receipt.readAt
          : null) || new Date(0);

      const unreadCount = await GroupMessage.countDocuments({
        groupId: group._id,
        from: { $ne: userId },
        createdAt: { $gt: lastReadAt },
      });

      if (unreadCount > 0) {
        groupCounts[String(group._id)] = unreadCount;
      }
    }

    const totalUnread =
      Object.values(conversationCounts).reduce((a, b) => a + b, 0) +
      Object.values(groupCounts).reduce((a, b) => a + b, 0);

    const result = {
      conversations: conversationCounts,
      groups: groupCounts,
      total: totalUnread,
    };

    void redisSet(cacheKey, result, TTL.statuses);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("GET /api/unread-counts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
