import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";

// ---------- Lean interfaces ----------
interface MessageLean {
  _id: Types.ObjectId;
  from?: Types.ObjectId;
  to?: Types.ObjectId;
}

interface GroupMessageLean {
  _id: Types.ObjectId;
  groupId?: Types.ObjectId;
}

interface GroupMemberLean {
  userId: Types.ObjectId;
}

interface GroupLean {
  _id: Types.ObjectId;
  members?: GroupMemberLean[];
}

interface ConversationLean {
  _id: Types.ObjectId;
  userA: Types.ObjectId;
  userB: Types.ObjectId;
}

interface ReadReceiptLean {
  readAt?: Date;
}

// ---------- Helpers ----------
const isValidObjectId = (v: unknown): v is string =>
  typeof v === "string" && Types.ObjectId.isValid(v);

const toObjectId = (v: string): Types.ObjectId => new Types.ObjectId(v);

// Safe socket emit
const safeEmitToUser = (userId: string, event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io || !userId) return false;
    io.to(userId).emit(event, payload);
    return true;
  } catch {
    return false;
  }
};

const safeEmitToUsers = (userIds: string[], event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io) return false;
    userIds.forEach((id) => id && io.to(id).emit(event, payload));
    return true;
  } catch {
    return false;
  }
};

// ---------- POST ----------
export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isValidObjectId(session.id)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = toObjectId(session.id);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const messageId = typeof body.messageId === "string" ? body.messageId : undefined;
    const groupMessageId = typeof body.groupMessageId === "string" ? body.groupMessageId : undefined;
    const conversationId = typeof body.conversationId === "string" ? body.conversationId : undefined;
    const groupId = typeof body.groupId === "string" ? body.groupId : undefined;
    const peerId = typeof body.peerId === "string" ? body.peerId : undefined;

    const identifiers = { messageId, groupMessageId, conversationId, groupId, peerId };
    const provided = Object.values(identifiers).filter(Boolean);
    if (provided.length === 0) {
      return NextResponse.json({ error: "No identifier provided" }, { status: 400 });
    }
    if (provided.length > 1) {
      return NextResponse.json({ error: "Provide only one identifier" }, { status: 400 });
    }

    await connectDB();
    const now = new Date();

    // 1) Direct message
    if (messageId && isValidObjectId(messageId)) {
      const message = (await Message.findById(messageId)
        .select("from to")
        .lean()
        .exec()) as MessageLean | null;

      if (!message) {
        return NextResponse.json({ error: "Message not found" }, { status: 404 });
      }
      if (String(message.to) !== String(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        { userId, messageId: toObjectId(messageId) },
        { userId, messageId: toObjectId(messageId), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      safeEmitToUser(String(message.from ?? ""), "message:status:update", {
        id: String(message._id),
        status: "seen",
      });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 2) Group message
    if (groupMessageId && isValidObjectId(groupMessageId)) {
      const gm = (await GroupMessage.findById(groupMessageId)
        .select("groupId")
        .lean()
        .exec()) as GroupMessageLean | null;

      if (!gm || !gm.groupId) {
        return NextResponse.json({ error: "Group message not found" }, { status: 404 });
      }
      if (!isValidObjectId(gm.groupId)) {
        return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });
      }

      const group = (await Group.findById(gm.groupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      const isMember = group.members?.some((m) => String(m.userId) === String(userId)) ?? false;
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        { userId, groupMessageId: toObjectId(groupMessageId) },
        {
          userId,
          groupMessageId: toObjectId(groupMessageId),
          groupId: toObjectId(String(gm.groupId)),
          readAt: now,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const targets = (group.members ?? [])
        .map((m) => String(m.userId))
        .filter((id) => id && id !== String(userId));
      safeEmitToUsers(targets, "group:message:read", {
        groupMessageId: String(groupMessageId),
        groupId: String(gm.groupId),
        userId: String(userId),
      });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 3) Conversation (mark entire conversation read)
    if (conversationId && isValidObjectId(conversationId)) {
      const conversation = (await Conversation.findById(conversationId)
        .select("userA userB")
        .lean()
        .exec()) as ConversationLean | null;

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      const isParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);
      if (!isParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const receipt = (await ReadReceipt.findOneAndUpdate(
        { userId, conversationId: toObjectId(conversationId) },
        { userId, conversationId: toObjectId(conversationId), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ).lean()) as ReadReceiptLean | null;

      const other = String(conversation.userA) === String(userId)
        ? String(conversation.userB)
        : String(conversation.userA);
      safeEmitToUser(other, "conversation:read", {
        conversationId: String(conversation._id),
        userId: String(userId),
      });

      return NextResponse.json({ success: true, readAt: receipt?.readAt ?? now });
    }

    // 4) Group-level read
    if (groupId && isValidObjectId(groupId)) {
      const group = (await Group.findById(groupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      const isMember = group.members?.some((m) => String(m.userId) === String(userId)) ?? false;
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        { userId, groupId: toObjectId(String(groupId)) },
        { userId, groupId: toObjectId(String(groupId)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const targets = (group.members ?? [])
        .map((m) => String(m.userId))
        .filter((id) => id && id !== String(userId));
      safeEmitToUsers(targets, "group:read", {
        groupId: String(groupId),
        userId: String(userId),
      });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 5) Peer-based conversation
    if (peerId && isValidObjectId(peerId)) {
      const peerObjectId = toObjectId(peerId);
      const currentId = String(userId);
      const peerString = String(peerObjectId);
      const userA = currentId < peerString ? userId : peerObjectId;
      const userB = currentId < peerString ? peerObjectId : userId;

      const conversation = (await Conversation.findOne({ userA, userB })
        .select("_id userA userB")
        .lean()
        .exec()) as ConversationLean | null;

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }

      await ReadReceipt.findOneAndUpdate(
        { userId, conversationId: toObjectId(String(conversation._id)) },
        { userId, conversationId: toObjectId(String(conversation._id)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const other = String(conversation.userA) === String(userId)
        ? String(conversation.userB)
        : String(conversation.userA);
      safeEmitToUser(other, "conversation:read", {
        conversationId: String(conversation._id),
        userId: String(userId),
      });

      return NextResponse.json({ success: true, readAt: now });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("POST /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ---------- GET ----------
export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isValidObjectId(session.id)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const userId = toObjectId(session.id);

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const groupId = searchParams.get("groupId");

    await connectDB();

    if (conversationId && isValidObjectId(conversationId)) {
      const conversation = (await Conversation.findById(conversationId)
        .select("userA userB")
        .lean()
        .exec()) as ConversationLean | null;

      if (!conversation) {
        return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      }
      const isParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);
      if (!isParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const receipt = (await ReadReceipt.findOne({
        userId,
        conversationId: toObjectId(conversationId),
      }).lean()) as ReadReceiptLean | null;
      return NextResponse.json({ readAt: receipt?.readAt ?? null });
    }

    if (groupId && isValidObjectId(groupId)) {
      const group = (await Group.findById(groupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }
      const isMember = group.members?.some((m) => String(m.userId) === String(userId)) ?? false;
      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const receipt = (await ReadReceipt.findOne({
        userId,
        groupId: toObjectId(groupId),
      }).lean()) as ReadReceiptLean | null;
      return NextResponse.json({ readAt: receipt?.readAt ?? null });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GET /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}