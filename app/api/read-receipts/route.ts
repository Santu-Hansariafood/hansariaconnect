import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import { getUserSession } from "@/lib/sessionAuth";

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
    const { messageId, groupMessageId, conversationId, groupId, peerId } = body;

    await connectDB();

    if (messageId && Types.ObjectId.isValid(messageId)) {
      const message = await Message.findById(messageId);
      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      }
      if (String(message.to) !== String(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      await ReadReceipt.findOneAndUpdate(
        { userId, messageId: new Types.ObjectId(messageId) },
        {
          userId,
          messageId: new Types.ObjectId(messageId),
          readAt: new Date(),
        },
        { upsert: true },
      );
    } else if (groupMessageId && Types.ObjectId.isValid(groupMessageId)) {
      await ReadReceipt.findOneAndUpdate(
        { userId, groupMessageId: new Types.ObjectId(groupMessageId) },
        {
          userId,
          groupMessageId: new Types.ObjectId(groupMessageId),
          readAt: new Date(),
        },
        { upsert: true },
      );
    } else if (conversationId && Types.ObjectId.isValid(conversationId)) {
      await ReadReceipt.findOneAndUpdate(
        { userId, conversationId: new Types.ObjectId(conversationId) },
        {
          userId,
          conversationId: new Types.ObjectId(conversationId),
          readAt: new Date(),
        },
        { upsert: true },
      );
    } else if (groupId && Types.ObjectId.isValid(groupId)) {
      await ReadReceipt.findOneAndUpdate(
        { userId, groupId: new Types.ObjectId(groupId) },
        { userId, groupId: new Types.ObjectId(groupId), readAt: new Date() },
        { upsert: true },
      );
    } else if (peerId && Types.ObjectId.isValid(peerId)) {
      const a = String(userId);
      const b = String(peerId);
      const userA = a < b ? userId : new Types.ObjectId(peerId);
      const userB = a < b ? new Types.ObjectId(peerId) : userId;
      await connectDB();
      const conv = await (
        await import("@/models/conversation/Conversation")
      ).default
        .findOne({ userA, userB })
        .lean();
      if (!conv) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          conversationId: new Types.ObjectId(String((conv as any)._id)),
        },
        {
          userId,
          conversationId: new Types.ObjectId(String((conv as any)._id)),
          readAt: new Date(),
        },
        { upsert: true },
      );
    } else {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("POST /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const groupId = searchParams.get("groupId");

    await connectDB();

    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      const receipt = await ReadReceipt.findOne({
        userId,
        conversationId: new Types.ObjectId(conversationId),
      });
      return NextResponse.json({ readAt: receipt?.readAt || null });
    } else if (groupId && Types.ObjectId.isValid(groupId)) {
      const receipt = await ReadReceipt.findOne({
        userId,
        groupId: new Types.ObjectId(groupId),
      });
      return NextResponse.json({ readAt: receipt?.readAt || null });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GET /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
