import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";

import { connectDB } from "@/lib/db/db";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";

/**
 * ---------------------------------------------------------------------------
 * Lean document types
 * ---------------------------------------------------------------------------
 */

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

/**
 * Explicit type for Conversation lean documents.
 *
 * This fixes the TypeScript error:
 *
 * Property 'userA' does not exist on type ...
 * Property 'userB' does not exist on type ...
 */
interface ConversationLean {
  _id: Types.ObjectId;
  userA: Types.ObjectId | string;
  userB: Types.ObjectId | string;
}

/**
 * ---------------------------------------------------------------------------
 * Socket helpers
 * ---------------------------------------------------------------------------
 */

/**
 * Emit an event to a single user's socket room.
 *
 * Socket.IO may not be available in the current Next.js process,
 * so this helper intentionally fails safely.
 */
const safeEmitToUser = (
  userId: string,
  event: string,
  payload: unknown,
): boolean => {
  try {
    const io = (globalThis as any).__io;

    if (!io) {
      console.warn("Socket IO not available to emit", event, userId);

      return false;
    }

    if (!userId) {
      return false;
    }

    io.to(userId).emit(event, payload);

    return true;
  } catch (err) {
    console.error("safeEmitToUser error:", err);

    return false;
  }
};

/**
 * Emit an event to multiple user rooms.
 */
const safeEmitToUsers = (
  userIds: string[],
  event: string,
  payload: unknown,
): boolean => {
  try {
    const io = (globalThis as any).__io;

    if (!io) {
      console.warn("Socket IO not available to emit", event);

      return false;
    }

    userIds.forEach((id) => {
      if (id) {
        io.to(id).emit(event, payload);
      }
    });

    return true;
  } catch (err) {
    console.error("safeEmitToUsers error:", err);

    return false;
  }
};

/**
 * ---------------------------------------------------------------------------
 * POST
 * ---------------------------------------------------------------------------
 *
 * Supported identifiers:
 *
 * 1. messageId
 * 2. groupMessageId
 * 3. conversationId
 * 4. groupId
 * 5. peerId
 *
 * Only ONE identifier may be supplied per request.
 */
export async function POST(req: NextRequest) {
  try {
    /**
     * -----------------------------------------------------------------------
     * Authenticate user
     * -----------------------------------------------------------------------
     */

    const session = await getUserSession(req);

    if (!session?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const normalizedId = String(session.id);

    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json(
        {
          error: "Invalid session",
        },
        {
          status: 401,
        },
      );
    }

    const userId = new Types.ObjectId(normalizedId);

    /**
     * -----------------------------------------------------------------------
     * Parse request body
     * -----------------------------------------------------------------------
     */

    let body: Record<string, unknown>;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: "Invalid JSON body",
        },
        {
          status: 400,
        },
      );
    }

    const { messageId, groupMessageId, conversationId, groupId, peerId } = body;

    /**
     * -----------------------------------------------------------------------
     * Validate identifiers
     * -----------------------------------------------------------------------
     */

    const provided = [
      messageId,
      groupMessageId,
      conversationId,
      groupId,
      peerId,
    ].filter(Boolean);

    if (provided.length === 0) {
      return NextResponse.json(
        {
          error: "No identifier provided",
        },
        {
          status: 400,
        },
      );
    }

    if (provided.length > 1) {
      return NextResponse.json(
        {
          error: "Provide only one identifier",
        },
        {
          status: 400,
        },
      );
    }

    /**
     * -----------------------------------------------------------------------
     * Database connection
     * -----------------------------------------------------------------------
     */

    await connectDB();

    /**
     * =======================================================================
     * CASE 1: Individual message
     * =======================================================================
     */

    if (typeof messageId === "string" && Types.ObjectId.isValid(messageId)) {
      const message = (await Message.findById(messageId)
        .lean()
        .exec()) as MessageLean | null;

      if (!message) {
        return NextResponse.json(
          {
            error: "Message not found",
          },
          {
            status: 404,
          },
        );
      }

      /**
       * Only the recipient can mark the message as read.
       */
      if (String(message.to) !== String(userId)) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
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

      /**
       * Notify message sender.
       */
      try {
        safeEmitToUser(String(message.from ?? ""), "message:status:update", {
          id: String(message._id),
          status: "seen",
        });
      } catch (socketError) {
        console.error(
          "Individual message socket notification failed:",
          socketError,
        );
      }
    } else if (

    /**
     * =======================================================================
     * CASE 2: Group message
     * =======================================================================
     */
      typeof groupMessageId === "string" &&
      Types.ObjectId.isValid(groupMessageId)
    ) {
      const gm = (await GroupMessage.findById(groupMessageId)
        .lean()
        .exec()) as GroupMessageLean | null;

      if (!gm) {
        return NextResponse.json(
          {
            error: "Group message not found",
          },
          {
            status: 404,
          },
        );
      }

      if (!gm.groupId) {
        return NextResponse.json(
          {
            error: "Group ID missing from group message",
          },
          {
            status: 400,
          },
        );
      }

      const normalizedGroupId = String(gm.groupId);

      if (!Types.ObjectId.isValid(normalizedGroupId)) {
        return NextResponse.json(
          {
            error: "Invalid group ID",
          },
          {
            status: 400,
          },
        );
      }

      /**
       * ---------------------------------------------------------------------
       * Verify group membership
       * ---------------------------------------------------------------------
       */

      const group = (await Group.findById(normalizedGroupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json(
          {
            error: "Group not found",
          },
          {
            status: 404,
          },
        );
      }

      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
      }

      /**
       * ---------------------------------------------------------------------
       * Save group message read receipt
       * ---------------------------------------------------------------------
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

      /**
       * ---------------------------------------------------------------------
       * Notify other group members
       * ---------------------------------------------------------------------
       */

      try {
        const targetIds = (group.members ?? [])
          .map((member) => String(member.userId))
          .filter((id) => Boolean(id) && id !== String(userId));

        safeEmitToUsers(targetIds, "group:message:read", {
          groupMessageId: String(groupMessageId),
          groupId: normalizedGroupId,
          userId: String(userId),
        });
      } catch (socketError) {
        console.error("Group message socket notification failed:", socketError);
      }
    } else if (

    /**
     * =======================================================================
     * CASE 3: Conversation
     * =======================================================================
     */
      typeof conversationId === "string" &&
      Types.ObjectId.isValid(conversationId)
    ) {
      /**
       * IMPORTANT:
       *
       * Explicitly cast the lean result to ConversationLean.
       *
       * This is the fix for the build error shown in your screenshot.
       */
      const conversation = (await Conversation.findById(conversationId)
        .select("userA userB")
        .lean()
        .exec()) as ConversationLean | null;

      if (!conversation) {
        return NextResponse.json(
          {
            error: "Conversation not found",
          },
          {
            status: 404,
          },
        );
      }

      /**
       * Verify that the current user belongs to this conversation.
       */
      const userIsParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);

      if (!userIsParticipant) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
      }

      const now = new Date();

      /**
       * Save conversation-level read receipt.
       */
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

      /**
       * Notify the other participant.
       */
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
    } else if (typeof groupId === "string" && Types.ObjectId.isValid(groupId)) {

    /**
     * =======================================================================
     * CASE 4: Group
     * =======================================================================
     */
      const group = (await Group.findById(groupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json(
          {
            error: "Group not found",
          },
          {
            status: 404,
          },
        );
      }

      /**
       * Verify membership.
       */
      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
      }

      /**
       * Save group-level read receipt.
       */
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

      /**
       * Notify other group members.
       */
      try {
        const targetIds = (group.members ?? [])
          .map((member) => String(member.userId))
          .filter((id) => Boolean(id) && id !== String(userId));

        safeEmitToUsers(targetIds, "group:read", {
          groupId: String(groupId),
          userId: String(userId),
        });
      } catch (socketError) {
        console.error("Group read socket notification failed:", socketError);
      }
    } else if (typeof peerId === "string" && Types.ObjectId.isValid(peerId)) {

    /**
     * =======================================================================
     * CASE 5: Peer ID
     * =======================================================================
     */
      const peerObjectId = new Types.ObjectId(peerId);

      const currentId = String(userId);
      const peerString = String(peerObjectId);

      /**
       * Keep userA/userB ordering consistent.
       */
      const userA = currentId < peerString ? userId : peerObjectId;

      const userB = currentId < peerString ? peerObjectId : userId;

      /**
       * Find the conversation between the two users.
       *
       * We only need _id here, so select only that field.
       */
      const conversation = await Conversation.findOne({
        userA,
        userB,
      })
        .select("_id")
        .lean()
        .exec();

      if (!conversation) {
        return NextResponse.json(
          {
            error: "Conversation not found",
          },
          {
            status: 404,
          },
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

    /**
     * =======================================================================
     * Invalid identifier
     * =======================================================================
     */
      return NextResponse.json(
        {
          error: "Invalid request",
        },
        {
          status: 400,
        },
      );
    }

    /**
     * -----------------------------------------------------------------------
     * Success
     * -----------------------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
    });
  } catch (error: unknown) {
    console.error("POST /api/read-receipts error →", error);

    const message = error instanceof Error ? error.message : "Server error";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}

/**
 * ---------------------------------------------------------------------------
 * GET
 * ---------------------------------------------------------------------------
 *
 * Supported query parameters:
 *
 * ?conversationId=...
 * ?groupId=...
 */
export async function GET(req: NextRequest) {
  try {
    /**
     * -----------------------------------------------------------------------
     * Authenticate user
     * -----------------------------------------------------------------------
     */

    const session = await getUserSession(req);

    if (!session?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    const normalizedId = String(session.id);

    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json(
        {
          error: "Invalid session",
        },
        {
          status: 401,
        },
      );
    }

    const userId = new Types.ObjectId(normalizedId);

    /**
     * -----------------------------------------------------------------------
     * Parse query parameters
     * -----------------------------------------------------------------------
     */

    const { searchParams } = new URL(req.url);

    const conversationId = searchParams.get("conversationId");

    const groupId = searchParams.get("groupId");

    /**
     * -----------------------------------------------------------------------
     * Database connection
     * -----------------------------------------------------------------------
     */

    await connectDB();

    /**
     * =======================================================================
     * CASE 1: Conversation read receipt
     * =======================================================================
     */

    if (conversationId && Types.ObjectId.isValid(conversationId)) {
      /**
       * Fetch only the fields required for authorization.
       */
      const conversation = (await Conversation.findById(conversationId)
        .select("userA userB")
        .lean()
        .exec()) as ConversationLean | null;

      if (!conversation) {
        return NextResponse.json(
          {
            error: "Conversation not found",
          },
          {
            status: 404,
          },
        );
      }

      /**
       * Verify current user is a participant.
       */
      const isParticipant =
        String(conversation.userA) === String(userId) ||
        String(conversation.userB) === String(userId);

      if (!isParticipant) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
      }

      /**
       * Get current user's read receipt.
       */
      const receipt = await ReadReceipt.findOne({
        userId,
        conversationId: new Types.ObjectId(conversationId),
      })
        .select("readAt")
        .lean()
        .exec();

      return NextResponse.json({
        readAt: receipt?.readAt ?? null,
      });
    }

    /**
     * =======================================================================
     * CASE 2: Group read receipt
     * =======================================================================
     */

    if (groupId && Types.ObjectId.isValid(groupId)) {
      /**
       * Fetch group members for authorization.
       */
      const group = (await Group.findById(groupId)
        .select("members")
        .lean()
        .exec()) as GroupLean | null;

      if (!group) {
        return NextResponse.json(
          {
            error: "Group not found",
          },
          {
            status: 404,
          },
        );
      }

      /**
       * Verify current user belongs to the group.
       */
      const isMember =
        Array.isArray(group.members) &&
        group.members.some(
          (member) => String(member.userId) === String(userId),
        );

      if (!isMember) {
        return NextResponse.json(
          {
            error: "Forbidden",
          },
          {
            status: 403,
          },
        );
      }

      /**
       * Get current user's group read receipt.
       */
      const receipt = await ReadReceipt.findOne({
        userId,
        groupId: new Types.ObjectId(groupId),
      })
        .select("readAt")
        .lean()
        .exec();

      return NextResponse.json({
        readAt: receipt?.readAt ?? null,
      });
    }

    /**
     * -----------------------------------------------------------------------
     * Invalid request
     * -----------------------------------------------------------------------
     */

    return NextResponse.json(
      {
        error: "Invalid request",
      },
      {
        status: 400,
      },
    );
  } catch (error: unknown) {
    console.error("GET /api/read-receipts error →", error);

    const message = error instanceof Error ? error.message : "Server error";

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      },
    );
  }
}
