import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import Message from "@/models/message/Message";
import { Types } from "mongoose";

// -----------------------------
// Interfaces for Lean Documents
// -----------------------------
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

interface IConversation {
  _id: string;
  userA: string | Types.ObjectId;
  userB: string | Types.ObjectId;
  createdAt: Date;
  lastMessageAt?: Date;
  [key: string]: any;
}

// -----------------------------
// Normalize ID Helper
// -----------------------------
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

// -----------------------------
// GET Handler
// -----------------------------
export async function GET(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Normalize & validate userId
    const rawUserId = normalizeId(session.id);
    if (!Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const userId = new Types.ObjectId(rawUserId);

    // Connect DB
    await connectDB();

    // Fetch conversations
    const conversations = (await Conversation.find({
  $or: [{ userA: userId }, { userB: userId }],
})
  .sort({ lastMessageAt: -1 })
  .lean()) as unknown as IConversation[];

    if (!conversations.length) {
      return NextResponse.json({ conversations: [] });
    }

    const conversationResults: any[] = [];

    // -----------------------------
    // Build Conversation Response
    // -----------------------------
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

      conversationResults.push({
        id: String(peerId),
        peerId: String(peerId),
        mobile: peerUser.mobile || "",
        name: peerProfile?.name || peerUser.mobile || "Unknown",
        avatar: peerProfile?.photo || "",
        lastMessageAt: conv.lastMessageAt || conv.createdAt || new Date(),

        lastMessage: lastMessage
          ? {
              id: String(lastMessage._id),
              type: lastMessage.type,
              text: lastMessage.text || "",
              from: String(lastMessage.from),
              to: String(lastMessage.to),
              timestamp: lastMessage.createdAt,
              status: lastMessage.status ?? "sent",
            }
          : null,
      });
    }

    return NextResponse.json({ conversations: conversationResults });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Server Error" },
      { status: 500 }
    );
  }
}
