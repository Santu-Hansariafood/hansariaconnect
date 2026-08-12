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

    /*
     * ---------------------------------------------------------
     * 1. INDIVIDUAL MESSAGE
     * ---------------------------------------------------------
     */

    if (messageId && Types.ObjectId.isValid(messageId)) {
      const message = (await Message.findById(messageId).lean()) as any;

      if (!message) {
        return NextResponse.json(
          { error: "Message not found" },
          { status: 404 },
        );
      }

      // Only recipient can mark the message as read
      if (String(message.to) !== String(userId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          messageId: new Types.ObjectId(messageId),
        },
        {
          userId,
          messageId: new Types.ObjectId(messageId),
          readAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      /*
       * Notify sender
       */
      try {
        const senderId = String(message.from);
        const io = (globalThis as any).__io;

        if (io && senderId) {
          io.to(senderId).emit("message:status:update", {
            id: String(message._id),
            status: "seen",
          });
        }
      } catch (socketError) {
        console.error(
          "Individual message socket notification failed:",
          socketError,
        );
      }
    } else if (groupMessageId && Types.ObjectId.isValid(groupMessageId)) {

    /*
     * ---------------------------------------------------------
     * 2. GROUP MESSAGE
     * ---------------------------------------------------------
     */
      /*
       * Cast the lean result to our local type.
       *
       * This fixes the TypeScript error:
       * Property 'groupId' does not exist...
       */
      const gm = (await GroupMessage.findById(groupMessageId)
        .lean()
        .exec()) as GroupMessageLean | null;

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
      const group = (await Group.findById(normalizedGroupId)
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

      /*
       * Save read receipt
       */
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

      /*
       * Notify other group members
       */
      try {
        const io = (globalThis as any).__io;

        if (io && Array.isArray(group.members)) {
          group.members.forEach((member) => {
            const memberId = String(member.userId);

            if (memberId && memberId !== String(userId)) {
              io.to(memberId).emit("group:message:read", {
                groupMessageId: String(groupMessageId),
                groupId: normalizedGroupId,
                userId: String(userId),
              });
            }
          });
        }
      } catch (socketError) {
        console.error("Group message socket notification failed:", socketError);
      }
    } else if (conversationId && Types.ObjectId.isValid(conversationId)) {

    /*
     * ---------------------------------------------------------
     * 3. CONVERSATION
     * ---------------------------------------------------------
     */
      const conversation = await Conversation.findById(conversationId).lean();

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }

      /*
       * Ensure the current user actually belongs
       * to this conversation.
       */
      const userIsParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);

      if (!userIsParticipant) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          conversationId: new Types.ObjectId(conversationId),
        },
        {
          userId,
          conversationId: new Types.ObjectId(conversationId),
          readAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );

      /*
       * Notify the other participant
       */
      try {
        const a = String(conversation.userA);
        const b = String(conversation.userB);

        const other = a === String(userId) ? b : a;

        const io = (globalThis as any).__io;

        if (io && other) {
          io.to(other).emit("conversation:read", {
            conversationId: String(conversationId),
            userId: String(userId),
          });
        }
      } catch (socketError) {
        console.error("Conversation socket notification failed:", socketError);
      }
    } else if (groupId && Types.ObjectId.isValid(groupId)) {

    /*
     * ---------------------------------------------------------
     * 4. GROUP
     * ---------------------------------------------------------
     */
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

      /*
       * Notify other group members
       */
      try {
        const io = (globalThis as any).__io;

        if (io && Array.isArray(group.members)) {
          group.members.forEach((member) => {
            const memberId = String(member.userId);

            if (memberId && memberId !== String(userId)) {
              io.to(memberId).emit("group:read", {
                groupId: String(groupId),
                userId: String(userId),
              });
            }
          });
        }
      } catch (socketError) {
        console.error("Group read socket notification failed:", socketError);
      }
    } else if (peerId && Types.ObjectId.isValid(peerId)) {

    /*
     * ---------------------------------------------------------
     * 5. PEER
     * ---------------------------------------------------------
     */
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

      await ReadReceipt.findOneAndUpdate(
        {
          userId,
          conversationId: new Types.ObjectId(String(conversation._id)),
        },
        {
          userId,
          conversationId: new Types.ObjectId(String(conversation._id)),
          readAt: new Date(),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
        },
      );
    } else {

    /*
     * ---------------------------------------------------------
     * INVALID REQUEST
     * ---------------------------------------------------------
     */
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

/*
 * =========================================================
 * GET READ RECEIPT
 * =========================================================
 */

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

    /*
     * Conversation receipt
     */
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

    /*
     * Group receipt
     */
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
