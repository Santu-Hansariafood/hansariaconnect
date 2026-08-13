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

    if (typeof obj.$oid === "string") {
      return obj.$oid;
    }

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

    const { searchParams } = new URL(req.url);

    const chatId = searchParams.get("chatId") || "";

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

    const userId = new Types.ObjectId(normalizedUserId);
    const chatObjectId = new Types.ObjectId(chatId);

    await connectDB();

    const group = (await Group.findById(
      chatObjectId,
    ).lean()) as GroupDoc | null;

    if (group) {
      const members = Array.isArray(group.members) ? group.members : [];

      const isMember = members.some(
        (member: IGroupMember) => String(member.userId) === String(userId),
      );

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

      return NextResponse.json({
        access: true,
        type: "group",
        name: group.name,
      });
    }

    const peerUser = await User.findById(chatObjectId).lean();

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

    if (Array.isArray(peerUser)) {
      return NextResponse.json(
        {
          error: "Unexpected data format",
          access: false,
        },
        { status: 500 },
      );
    }

    const peerUserDoc = peerUser as { mobile?: string; _id: any };
    const Conversation = (await import("@/models/conversation/Conversation"))
      .default;
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
        { mobiles: { $in: [peerUserDoc.mobile || ""] } }, // ✅ now uses peerUserDoc
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
    const message = err instanceof Error ? err.message : String(err);

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
