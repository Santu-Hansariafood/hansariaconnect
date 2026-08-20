import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import { getUserSession } from "@/lib/sessionAuth";
import {
  encryptDirectMessageContent,
  decryptDirectMessageContent,
} from "@/lib/crypto";

export const runtime = "nodejs";

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") {
    return val.trim();
  }
  if (val == null) return String(val);
  if (
    typeof val === "number" ||
    typeof val === "bigint" ||
    typeof val === "boolean"
  )
    return String(val);

  if (typeof val === "object") {
    const obj = val as {
      toString?: () => string;
      $oid?: unknown;
      _id?: unknown;
    };
    if (obj._id && typeof obj._id === "object" && "_id" in obj._id) {
      const idObj = obj._id as { toString?: () => string };
      if (typeof idObj.toString === "function") {
        const s = idObj.toString();
        if (s && s !== "[object Object]") return s;
      }
    }
    if (typeof obj.$oid === "string") return obj.$oid;
    if (typeof obj.toString === "function") {
      const s = obj.toString();
      if (s && s !== "[object Object]") return s;
    }
    if (obj._id) {
      return normalizeId(obj._id);
    }
  }

  return String(val);
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;

    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawUserId = normalizeId(session.id);
    const rawPeerId = normalizeId(resolvedParams.peerId);

    if (!Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (!Types.ObjectId.isValid(rawPeerId)) {
      return NextResponse.json({ error: "Invalid peer id" }, { status: 400 });
    }
    const userId = new Types.ObjectId(rawUserId);
    const peerId = new Types.ObjectId(rawPeerId);

    await connectDB();

    const peerExists = await User.exists({ _id: peerId });
    if (!peerExists) {
      return NextResponse.json({ error: "Peer not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);

    const limit = Math.max(
      5,
      Math.min(50, Number(searchParams.get("limit") || 20)),
    );
    const before = searchParams.get("before");
    const fetchAll = searchParams.get("all") === "true";
    const fetchLast = searchParams.get("last") === "true";

    const query: any = {
      $or: [
        { from: userId, to: peerId },
        { from: peerId, to: userId },
      ],
    };

    let sort: any = { createdAt: 1 };

    if (fetchLast && !fetchAll) {
      sort = { createdAt: -1 };
    } else if (before) {
      query.createdAt = { $lt: new Date(before) };
      sort = { createdAt: -1 };
    }

    const docs = fetchAll
      ? await Message.find(query).sort({ createdAt: 1 }).lean()
      : await Message.find(query).sort(sort).limit(limit).lean();

    const ordered = (fetchLast && !fetchAll) || before ? docs.reverse() : docs;

    const userIdStr = String(userId);
    const peerIdStr = String(peerId);

    const messages = ordered.map((msg: any) => ({
      id: String(msg._id),
      from: String(msg.from),
      to: String(msg.to),
      type: msg.type,
      text: decryptDirectMessageContent(userIdStr, peerIdStr, msg.text || ""),
      mediaUrl: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        msg.mediaUrl || "",
      ),
      fileName: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        msg.fileName || "",
      ),
      fileSize: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        msg.fileSize || "",
      ),
      duration: msg.duration || undefined,
      reactions:
        msg.reactions instanceof Map
          ? Object.fromEntries(msg.reactions)
          : msg.reactions || {},
      linkTitle: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        msg.linkTitle || "",
      ),
      linkDescription: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        msg.linkDescription || "",
      ),
      timestamp: msg.createdAt,
      status: msg.status || "sent",
    }));

    const hasMore = fetchAll
      ? false
      : (await Message.countDocuments({
          ...query,
          ...(before && { createdAt: { $lt: new Date(before) } }),
        })) > docs.length;

    return NextResponse.json({ messages, hasMore });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;

    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawUserId = normalizeId(session.id);
    const rawPeerId = normalizeId(resolvedParams.peerId);

    if (!Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    if (!Types.ObjectId.isValid(rawPeerId)) {
      return NextResponse.json({ error: "Invalid peer id" }, { status: 400 });
    }
    const userId = new Types.ObjectId(rawUserId);
    const peerId = new Types.ObjectId(rawPeerId);

    const body = await req.json();
    const type = String(body?.type || "text");

    await connectDB();

    const exists = await User.exists({ _id: peerId });
    if (!exists)
      return NextResponse.json({ error: "Peer not found" }, { status: 404 });

    const userIdStr = String(userId);
    const peerIdStr = String(peerId);

    const saved = await Message.create({
      from: userId,
      to: peerId,
      type,
      text: encryptDirectMessageContent(userIdStr, peerIdStr, body?.text || ""),
      mediaUrl: encryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        body?.mediaUrl || "",
      ),
      fileName: encryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        body?.fileName || "",
      ),
      fileSize: encryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        body?.fileSize || "",
      ),
      duration: body?.duration || undefined,
      linkTitle: encryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        body?.linkTitle || "",
      ),
      linkDescription: encryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        body?.linkDescription || "",
      ),
    });

    try {
      const a = String(userId);
      const b = String(peerId);
      const userA = a < b ? userId : peerId;
      const userB = a < b ? peerId : userId;

      await Conversation.findOneAndUpdate(
        { userA, userB },
        { userA, userB, lastMessageAt: new Date() },
        { upsert: true },
      );
    } catch {}

    const message = {
      id: String(saved._id),
      from: String(saved.from),
      to: String(saved.to),
      type: saved.type,
      text: decryptDirectMessageContent(userIdStr, peerIdStr, saved.text || ""),
      mediaUrl: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        saved.mediaUrl || "",
      ),
      fileName: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        saved.fileName || "",
      ),
      fileSize: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        saved.fileSize || "",
      ),
      duration: saved.duration || undefined,
      linkTitle: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        saved.linkTitle || "",
      ),
      linkDescription: decryptDirectMessageContent(
        userIdStr,
        peerIdStr,
        saved.linkDescription || "",
      ),
      timestamp: saved.createdAt,
      status: "sent",
    };

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Server error" },
      { status: 500 },
    );
  }
}

const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🔥", "✨", "🎉", "💯", "🤝"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = normalizeId(session.id);
    const peerId = normalizeId(resolvedParams.peerId);
    const body = await req.json();
    const messageId = normalizeId(body?.messageId);
    const emoji = String(body?.emoji || "");

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(peerId)) {
      return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
    }
    if (!Types.ObjectId.isValid(messageId) || !ALLOWED_REACTIONS.has(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    await connectDB();
    const updated = await Message.findOneAndUpdate(
      {
        _id: new Types.ObjectId(messageId),
        $or: [
          { from: new Types.ObjectId(userId), to: new Types.ObjectId(peerId) },
          { from: new Types.ObjectId(peerId), to: new Types.ObjectId(userId) },
        ],
      },
      { $inc: { [`reactions.${emoji}`]: 1 } },
      { new: true },
    );

    if (!updated) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    return NextResponse.json({
      reactions: Object.fromEntries(updated.reactions?.entries?.() ?? []),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
