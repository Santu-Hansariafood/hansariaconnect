import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Group, { IGroupMember } from "@/models/group/Group";
import { getUserSession } from "@/lib/sessionAuth";

export const runtime = "nodejs";

type GroupDoc = {
  _id: any;
  name: string;
  members: IGroupMember[];
};

/**
 * Convert different MongoDB/session ID formats into a string.
 */
const normalizeId = (val: unknown): string => {
  if (typeof val === "string") {
    return val.trim();
  }

  if (val == null) {
    return "";
  }

  if (
    typeof val === "number" ||
    typeof val === "bigint" ||
    typeof val === "boolean"
  ) {
    return String(val);
  }

  if (typeof val === "object") {
    const obj = val as {
      toString?: () => string;
      $oid?: unknown;
    };

    // Handle MongoDB Extended JSON ObjectId
    if (typeof obj.$oid === "string") {
      return obj.$oid;
    }

    // Handle ObjectId and similar objects
    if (typeof obj.toString === "function") {
      const value = obj.toString();

      if (value && value !== "[object Object]") {
        return value;
      }
    }
  }

  return "";
};

export async function GET(req: NextRequest) {
  try {
    // -----------------------------------------
    // Get current logged-in user's session
    // -----------------------------------------
    const session = await getUserSession(req);

    if (!session?.id) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          access: false,
        },
        {
          status: 401,
        },
      );
    }

    // -----------------------------------------
    // Get chatId from query parameters
    // -----------------------------------------
    const { searchParams } = new URL(req.url);

    const chatId = searchParams.get("chatId") || "";

    // -----------------------------------------
    // Validate chat ID
    // -----------------------------------------
    if (!chatId || !Types.ObjectId.isValid(chatId)) {
      return NextResponse.json(
        {
          error: "Invalid chat ID",
          access: false,
        },
        {
          status: 400,
        },
      );
    }

    // -----------------------------------------
    // Normalize session user ID
    // -----------------------------------------
    const normalizedUserId = normalizeId(session.id);

    if (!Types.ObjectId.isValid(normalizedUserId)) {
      return NextResponse.json(
        {
          error: "Invalid session",
          access: false,
        },
        {
          status: 401,
        },
      );
    }

    // -----------------------------------------
    // Convert IDs to MongoDB ObjectId
    // -----------------------------------------
    const userId = new Types.ObjectId(normalizedUserId);
    const chatObjectId = new Types.ObjectId(chatId);

    // -----------------------------------------
    // Connect to MongoDB
    // -----------------------------------------
    await connectDB();

    // =========================================================
    // 1. CHECK IF chatId BELONGS TO A GROUP
    // =========================================================

    const group = (await Group.findById(chatObjectId).lean()) as
      | GroupDoc
      | null;

    if (group) {
      const members = Array.isArray(group.members)
        ? group.members
        : [];

      // Check whether current user is a member of this group
      const isMember = members.some(
        (member: IGroupMember) =>
          String(member.userId) === String(userId),
      );

      // User is not a member of this group
      if (!isMember) {
        return NextResponse.json(
          {
            error: "Access denied",
            access: false,
            type: "group",
          },
          {
            status: 403,
          },
        );
      }

      // User is a group member
      return NextResponse.json({
        access: true,
        type: "group",
        name: group.name,
      });
    }

    // =========================================================
    // 2. CHECK IF chatId BELONGS TO A DIRECT USER
    // =========================================================

    const peerUser = await User.findById(chatObjectId).lean();

    // Direct-chat user does not exist
    if (!peerUser) {
      return NextResponse.json(
        {
          error: "Chat not found",
          access: false,
        },
        {
          status: 404,
        },
      );
    }

    // =========================================================
    // DIRECT CHAT ACCESS: Restrict to participants only
    // =========================================================
    // Allow access only if one of the following is true:
    // - There is an existing Conversation between the current user and peer
    // - The peer user is saved in the current user's contacts
    // - The current user is the same as the peer (self-chat)
    // This prevents arbitrary users from opening another user's chat UI
    // and potentially seeing encrypted payloads or sending unsolicited requests.

    const Conversation = (await import("@/models/conversation/Conversation")).default;
    const Contact = (await import("@/models/contact/Contact")).default;

    const isSelf = String(userId) === String(chatObjectId);

    const convExists = await Conversation.exists({
      $or: [
        { userA: userId, userB: chatObjectId },
        { userA: chatObjectId, userB: userId },
      ],
    });

    const contactExists = await Contact.exists({
      userId: userId,
      $or: [
        { registeredUserId: String(chatObjectId) },
        { mobiles: { $in: [peerUser.mobile || ""] } },
      ],
    });

    if (!isSelf && !convExists && !contactExists) {
      return NextResponse.json(
        {
          error: "Access denied",
          access: false,
        },
        {
          status: 403,
        },
      );
    }

    return NextResponse.json({
      access: true,
      type: "direct",
      peerId: String(chatObjectId),
    });
  } catch (err: unknown) {
    // -----------------------------------------
    // Error handling
    // -----------------------------------------
    const message =
      err instanceof Error ? err.message : String(err);

    console.error("Chat access error:", err);

    return NextResponse.json(
      {
        error: message || "Server error",
        access: false,
      },
      {
        status: 500,
      },
    );
  }
}