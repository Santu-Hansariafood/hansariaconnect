import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import Message from "@/models/message/Message";
import Group from "@/models/group/Group";
import GroupMessage from "@/models/group/GroupMessage";
import { Types } from "mongoose";
import { getUserSession } from "@/lib/sessionAuth";
import {
  decryptDirectMessageContent,
  decryptGroupMessageContent,
} from "@/lib/crypto";

interface IUser {
  _id: string;
  mobile?: string;
  [key: string]: any;
}

interface IProfile {
  _id: string;
  userId: string;
  name?: string;
  photo?: string;
}

interface IMessage {
  _id: string;
  text?: string;
  type: string;
  from: string | Types.ObjectId;
  to: string | Types.ObjectId;
  status?: string;
  createdAt: Date;
}

interface IGroupMessage {
  _id: string;
  text?: string;
  type: string;
  from: string | Types.ObjectId;
  groupId: string | Types.ObjectId;
  createdAt: Date;
}

interface IConversation {
  _id: string;
  userA: string | Types.ObjectId;
  userB: string | Types.ObjectId;
  createdAt: Date;
  lastMessageAt?: Date;
  [key: string]: any;
}

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val;
  if (val == null) return String(val);
  if (["number", "bigint", "boolean"].includes(typeof val)) return String(val);

  if (typeof val === "object") {
    const obj = val as { toString?: () => string; $oid?: unknown };
    if (typeof obj.$oid === "string") return obj.$oid;
    if (typeof obj.toString === "function") {
      const s = obj.toString();
      if (s && s !== "[object Object]") return s;
    }
  }
  return String(val);
};

export async function GET(req: NextRequest) {
  try {
    const session = await getUserSession(req);

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawUserId = normalizeId(session.id);
    if (!Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const userId = new Types.ObjectId(rawUserId);
    const userIdStr = String(userId);

    await connectDB();

    const conversations = (await Conversation.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .sort({ lastMessageAt: -1 })
      .lean()) as unknown as IConversation[];

    const conversationResults: any[] = [];

    for (const conv of conversations) {
      const peerId =
        String(conv.userA) === String(userId) ? conv.userB : conv.userA;

      const [peerUser, peerProfile, lastMessage] = await Promise.all([
        User.findById(peerId).lean() as Promise<IUser | null>,
        Profile.findOne({ userId: peerId }).lean() as Promise<IProfile | null>,
        Message.findOne({
          $or: [
            { from: userId, to: peerId },
            { from: peerId, to: userId },
          ],
        })
          .sort({ createdAt: -1 })
          .lean() as Promise<IMessage | null>,
      ]);

      if (!peerUser) continue;

      const peerIdStr = String(peerId);
      const decryptedLastMessage = lastMessage
        ? {
            id: String(lastMessage._id),
            type: lastMessage.type,
            text: decryptDirectMessageContent(userIdStr, peerIdStr, lastMessage.text || ""),
            from: String(lastMessage.from),
            to: String(lastMessage.to),
            timestamp: lastMessage.createdAt,
            status: lastMessage.status ?? "sent",
          }
        : null;

      conversationResults.push({
        id: String(peerId),
        peerId: String(peerId),
        mobile: peerUser.mobile || "",
        name: peerProfile?.name || peerUser.mobile || "Unknown",
        avatar: peerProfile?.photo || "",
        lastMessageAt: conv.lastMessageAt || conv.createdAt || new Date(),
        lastMessage: decryptedLastMessage,
      });
    }

    const groups = (await Group.find({
      "members.userId": userId,
    })
      .sort({ lastMessageAt: -1 })
      .lean()) as any[];

    for (const group of groups) {
      const groupIdStr = String(group._id);
      const lastGroupMsg = (await GroupMessage.findOne({
        groupId: group._id,
      })
        .sort({ createdAt: -1 })
        .lean()) as IGroupMessage | null;

      const members = Array.isArray(group.members) ? group.members : [];

      conversationResults.push({
        id: groupIdStr,
        peerId: groupIdStr,
        groupId: groupIdStr,
        isGroup: true,
        mobile: "",
        name: group.name || "Group",
        avatar: group.avatar || "",
        memberCount: members.length,
        lastMessageAt: group.lastMessageAt || group.updatedAt || group.createdAt || new Date(),
        lastMessage: lastGroupMsg
          ? {
              id: String(lastGroupMsg._id),
              type: lastGroupMsg.type,
              text: decryptGroupMessageContent(groupIdStr, lastGroupMsg.text || ""),
              from: String(lastGroupMsg.from),
              groupId: groupIdStr,
              timestamp: lastGroupMsg.createdAt,
            }
          : null,
      });
    }

    conversationResults.sort((a, b) => {
      const timeA = new Date(a.lastMessageAt).getTime();
      const timeB = new Date(b.lastMessageAt).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({ conversations: conversationResults });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Server Error" },
      { status: 500 },
    );
  }
}
