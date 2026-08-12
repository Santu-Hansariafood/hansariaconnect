import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";

interface GroupMessageLean {
  _id: Types.ObjectId;
  groupId?: Types.ObjectId | string;
}

interface GroupMemberLean {
  userId: Types.ObjectId | string;
}

interface GroupLean {
  _id: Types.ObjectId;
  members?: GroupMemberLean[];
}

interface MessageLean {
  _id: Types.ObjectId;
  from?: Types.ObjectId | string;
  to?: Types.ObjectId | string;
}

// Helper: emit to a single user room if socket is available
const safeEmitToUser = (userId: string, event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io) {
      // Socket server unavailable in this process (may be running in a different instance)
      console.warn("Socket IO not available to emit", event, userId);
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

// Helper: emit to multiple user ids
const safeEmitToUsers = (userIds: string[], event: string, payload: any) => {
  try {
    const io = (globalThis as any).__io;
    if (!io) {
      console.warn("Socket IO not available to emit", event);
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

    // Basic request validation: ensure fields are strings when present
    const provided = [messageId, groupMessageId, conversationId, groupId, peerId].filter(Boolean);
    if (provided.length === 0) {
      return NextResponse.json({ error: "No identifier provided" }, { status: 400 });
    }
    if (provided.length > 1) {
      // Require a single identifier per request to avoid ambiguity
      return NextResponse.json({ error: "Provide only one identifier" }, { status: 400 });
    }

    await connectDB();

  
    if (messageId && Types.ObjectId.isValid(messageId)) {
      const message = (await Message.findById(messageId).lean()) as MessageLean | null;

      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      }

      if (String(message.to) !== String(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const now = new Date();
      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          messageId: new Types.ObjectId(messageId),
        },
        {
          userId,
          messageId: new Types.ObjectId(messageId),
          readAt: now,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      try {
        safeEmitToUser(String(message.from ?? ""), "message:status:update", {
          id: String(message._id),
          status: "seen",
        });
      } catch (socketError) {
        console.error("Individual message socket notification failed:", socketError);
      }
    } else if (groupMessageId && Types.ObjectId.isValid(groupMessageId)) {

      const gm = (await GroupMessage.findById(groupMessageId).lean().exec()) as GroupMessageLean | null;

      if (!gm) {
        return NextResponse.json(
          { error: "Group message not found" },
          { status: 404 },
        );
      }

      if (!gm.groupId) {
        return NextResponse.json(
          { error: "Group ID missing from group message" },
          { status: 400 },
        );
      }

      const normalizedGroupId = String(gm.groupId);

      if (!Types.ObjectId.isValid(normalizedGroupId)) {
        return NextResponse.json(
          { error: "Invalid group ID" },
          { status: 400 },
        );
      }

      /*
       * Check that the current user actually belongs
       * to the group.
       */
      // Only fetch group members to minimize payload
      const group = (await Group.findById(normalizedGroupId).select("members").lean().exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          groupMessageId: new Types.ObjectId(groupMessageId),
        },
        {
          userId,
          groupMessageId: new Types.ObjectId(groupMessageId),
          groupId: new Types.ObjectId(normalizedGroupId),
          readAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      try {
        const targetIds = (group.members || [])
          .map((m) => String(m.userId))
          .filter((id) => id && id !== String(userId));
        safeEmitToUsers(targetIds, "group:message:read", {
          groupMessageId: String(groupMessageId),
          groupId: normalizedGroupId,
          userId: String(userId),
        });
      } catch (socketError) {
        console.error("Group message socket notification failed:", socketError);
      }
    } else if (conversationId && Types.ObjectId.isValid(conversationId)) {

      const conversation = await Conversation.findById(conversationId).select("userA userB").lean();

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      const userIsParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);

      if (!userIsParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const now = new Date();
      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          conversationId: new Types.ObjectId(conversationId),
        },
        {
          userId,
          conversationId: new Types.ObjectId(conversationId),
          readAt: now,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      try {
        const a = String(conversation.userA);
        const b = String(conversation.userB);
        const other = a === String(userId) ? b : a;
        safeEmitToUser(other, "conversation:read", {
          conversationId: String(conversationId),
          userId: String(userId),
        });
      } catch (socketError) {
        console.error("Conversation socket notification failed:", socketError);
      }
    } else if (groupId && Types.ObjectId.isValid(groupId)) {

      const group = (await Group.findById(groupId).select("members").lean().exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          groupId: new Types.ObjectId(groupId),
        },
        {
          userId,
          groupId: new Types.ObjectId(groupId),
          readAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      try {
        const targetIds = (group.members || []).map((m) => String(m.userId)).filter((id) => id && id !== String(userId));
        safeEmitToUsers(targetIds, "group:read", { groupId: String(groupId), userId: String(userId) });
      } catch (socketError) {
        console.error("Group read socket notification failed:", socketError);
      }
    } else if (peerId && Types.ObjectId.isValid(peerId)) {

      const peerObjectId = new Types.ObjectId(peerId);

      const currentId = String(userId);

      const peerString = String(peerObjectId);

      const userA = currentId < peerString ? userId : peerObjectId;

      const userB = currentId < peerString ? peerObjectId : userId;

      const conversation = await Conversation.findOne({
        userA,
        userB,
      }).lean();

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      const now = new Date();
      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          conversationId: new Types.ObjectId(String(conversation._id)),
        },
        {
          userId,
          conversationId: new Types.ObjectId(String(conversation._id)),
          readAt: now,
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
    } else {

      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
    });
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
      const conversation = await Conversation.findById(conversationId).lean();

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      const isParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);

      if (!isParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const receipt = await ReadReceipt.findOne({
        userId,
        conversationId: new Types.ObjectId(conversationId),
      }).lean();

      return NextResponse.json({
        readAt: receipt?.readAt ?? null,
      });
    }

    if (groupId && Types.ObjectId.isValid(groupId)) {
      const group = (await Group.findById(groupId)
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json({ error: "Group not found" }, { status: 404 });
      }

      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const receipt = await ReadReceipt.findOne({
        userId,
        groupId: new Types.ObjectId(groupId),
      }).lean();

      return NextResponse.json({
        readAt: receipt?.readAt ?? null,
      });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error: unknown) {
    console.error("GET /api/read-receipts error →", error);

    const message = error instanceof Error ? error.message : "Server error";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
