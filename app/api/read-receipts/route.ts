import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";

// Minimal lean types used locally to satisfy TypeScript while keeping queries small
interface MessageLean {
  _id: Types.ObjectId | string;
  from?: Types.ObjectId | string;
  to?: Types.ObjectId | string;
}

interface GroupMessageLean {
  _id: Types.ObjectId | string;
  groupId?: Types.ObjectId | string;
}

interface GroupMemberLean {
  userId: Types.ObjectId | string;
}

interface GroupLean {
  _id: Types.ObjectId | string;
  members?: GroupMemberLean[];
}

// Safe socket emit helpers — do not throw if socket server unavailable
const safeEmitToUser = (userId: string, event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io) {
      // Socket server might run in another process — log for monitoring
      console.warn("socket.io unavailable for emit", event, userId);
      return false;
    }
    if (!userId) return false;
    io.to(userId).emit(event, payload);
    return true;
  } catch (err) {
    console.error("safeEmitToUser error", err);
    return false;
  }
};

const safeEmitToUsers = (userIds: string[], event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io) {
      console.warn("socket.io unavailable for emit", event);
      return false;
    }
    userIds.forEach((id) => {
      if (id) io.to(id).emit(event, payload);
    });
    return true;
  } catch (err) {
    console.error("safeEmitToUsers error", err);
    return false;
  }
};

const isValidId = (v: unknown) => typeof v === "string" && Types.ObjectId.isValid(v);

export async function POST(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const userId = new Types.ObjectId(normalizedId);

    const body = await req.json().catch(() => ({}));
    const { messageId, groupMessageId, conversationId, groupId, peerId } = body ?? {};

    // Require exactly one identifier to avoid ambiguity
    const provided = [messageId, groupMessageId, conversationId, groupId, peerId].filter(Boolean);
    if (provided.length === 0) return NextResponse.json({ error: "No identifier provided" }, { status: 400 });
    if (provided.length > 1) return NextResponse.json({ error: "Provide only one identifier" }, { status: 400 });

    await connectDB();

    const now = new Date();

    // 1) Direct message read
    if (messageId && isValidId(messageId)) {
      const message = (await Message.findById(String(messageId)).select("from to").lean().exec()) as MessageLean | null;
      if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

      // Only recipient may mark as read
      if (String(message.to) !== String(userId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await ReadReceipt.findOneAndUpdate(
        { userId, messageId: new Types.ObjectId(String(messageId)) },
        { userId, messageId: new Types.ObjectId(String(messageId)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Notify sender (best-effort)
      safeEmitToUser(String(message.from ?? ""), "message:status:update", { id: String(message._id), status: "seen" });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 2) Group message read
    if (groupMessageId && isValidId(groupMessageId)) {
      const gm = (await GroupMessage.findById(String(groupMessageId)).select("groupId").lean().exec()) as GroupMessageLean | null;
      if (!gm) return NextResponse.json({ error: "Group message not found" }, { status: 404 });
      if (!gm.groupId) return NextResponse.json({ error: "Group ID missing" }, { status: 400 });

      const normalizedGroupId = String(gm.groupId);
      if (!Types.ObjectId.isValid(normalizedGroupId)) return NextResponse.json({ error: "Invalid group ID" }, { status: 400 });

      // Ensure membership
      const group = (await Group.findById(normalizedGroupId).select("members").lean().exec()) as GroupLean | null;
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      const isMember = Array.isArray(group.members) && group.members.some((m) => String(m.userId) === String(userId));
      if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await ReadReceipt.findOneAndUpdate(
        { userId, groupMessageId: new Types.ObjectId(String(groupMessageId)) },
        { userId, groupMessageId: new Types.ObjectId(String(groupMessageId)), groupId: new Types.ObjectId(normalizedGroupId), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      // Notify other connected group members (best-effort)
      const targets = (group.members || []).map((m) => String(m.userId)).filter((id) => id && id !== String(userId));
      safeEmitToUsers(targets, "group:message:read", { groupMessageId: String(groupMessageId), groupId: normalizedGroupId, userId: String(userId) });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 3) Conversation read (by conversation id)
    if (conversationId && isValidId(conversationId)) {
      const conversation = await Conversation.findById(String(conversationId)).select("userA userB").lean().exec();
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      const userIsParticipant = String(conversation.userA) === String(userId) || String(conversation.userB) === String(userId);
      if (!userIsParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await ReadReceipt.findOneAndUpdate(
        { userId, conversationId: new Types.ObjectId(String(conversationId)) },
        { userId, conversationId: new Types.ObjectId(String(conversationId)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const a = String(conversation.userA);
      const b = String(conversation.userB);
      const other = a === String(userId) ? b : a;
      safeEmitToUser(other, "conversation:read", { conversationId: String(conversationId), userId: String(userId) });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 4) Group-level read (mark group read)
    if (groupId && isValidId(groupId)) {
      const group = (await Group.findById(String(groupId)).select("members").lean().exec()) as GroupLean | null;
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      const isMember = Array.isArray(group.members) && group.members.some((m) => String(m.userId) === String(userId));
      if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      await ReadReceipt.findOneAndUpdate(
        { userId, groupId: new Types.ObjectId(String(groupId)) },
        { userId, groupId: new Types.ObjectId(String(groupId)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const targets = (group.members || []).map((m) => String(m.userId)).filter((id) => id && id !== String(userId));
      safeEmitToUsers(targets, "group:read", { groupId: String(groupId), userId: String(userId) });

      return NextResponse.json({ success: true, readAt: now });
    }

    // 5) Peer-based conversation by peerId (convenience)
    if (peerId && isValidId(peerId)) {
      const peerObjectId = new Types.ObjectId(String(peerId));
      const currentId = String(userId);
      const peerString = String(peerObjectId);
      const userA = currentId < peerString ? userId : peerObjectId;
      const userB = currentId < peerString ? peerObjectId : userId;

      const conversation = await Conversation.findOne({ userA, userB }).select("_id userA userB").lean().exec();
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });

      await ReadReceipt.findOneAndUpdate(
        { userId, conversationId: new Types.ObjectId(String(conversation._id)) },
        { userId, conversationId: new Types.ObjectId(String(conversation._id)), readAt: now },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      const a = String(conversation.userA);
      const b = String(conversation.userB);
      const other = a === String(userId) ? b : a;
      safeEmitToUser(other, "conversation:read", { conversationId: String(conversation._id), userId: String(userId) });

      return NextResponse.json({ success: true, readAt: now });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("POST /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const normalizedId = String(session.id);
    if (!Types.ObjectId.isValid(normalizedId)) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    const userId = new Types.ObjectId(normalizedId);

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");
    const groupId = searchParams.get("groupId");

    await connectDB();

    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      const conversation = await Conversation.findById(String(conversationId)).select("userA userB").lean().exec();
      if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
      const isParticipant = String(conversation.userA) === String(userId) || String(conversation.userB) === String(userId);
      if (!isParticipant) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const receipt = await ReadReceipt.findOne({ userId, conversationId: new Types.ObjectId(String(conversationId)) }).lean();
      return NextResponse.json({ readAt: receipt?.readAt ?? null });
    }

    if (groupId && Types.ObjectId.isValid(groupId)) {
      const group = (await Group.findById(String(groupId)).select("members").lean().exec()) as GroupLean | null;
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      const isMember = Array.isArray(group.members) && group.members.some((m) => String(m.userId) === String(userId));
      if (!isMember) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      const receipt = await ReadReceipt.findOne({ userId, groupId: new Types.ObjectId(String(groupId)) }).lean();
      return NextResponse.json({ readAt: receipt?.readAt ?? null });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GET /api/read-receipts error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
