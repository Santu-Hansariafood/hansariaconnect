import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";

export const runtime = "nodejs";

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val;
  if (val == null) return String(val);
  if (typeof val === "number" || typeof val === "bigint" || typeof val === "boolean") return String(val);

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

export async function GET(req: NextRequest, { params }: { params: { peerId: string } }) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let session: { id?: unknown } | null = null;
    try {
      session = JSON.parse(sessionCookie) as { id?: unknown };
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawUserId = normalizeId((session as any).id);
    const rawPeerId = normalizeId(params.peerId);
    if (!Types.ObjectId.isValid(rawUserId) || !Types.ObjectId.isValid(rawPeerId)) {
      return NextResponse.json({ error: "Invalid user or peer id" }, { status: 400 })
    }
    const userId = new Types.ObjectId(rawUserId)
    const peerId = new Types.ObjectId(rawPeerId)

    const { searchParams } = new URL(req.url);

    const overrideMe = normalizeId(searchParams.get("me"));
    const limit = Math.max(5, Math.min(50, Number(searchParams.get("limit") || 20)));
    const before = searchParams.get("before");
    const fetchAll = searchParams.get("all") === "true";
    const fetchLast = searchParams.get("last") === "true";

    await connectDB();

    const query: any = {
      $or: [
        { from: userId, to: peerId },
        { from: peerId, to: userId },
      ],
    };

    let sort: any = { createdAt: 1 };

    if (fetchLast) {
      sort = { createdAt: -1 };
    } else if (before) {
      query.createdAt = { $lt: new Date(before) };
      sort = { createdAt: -1 };
    }

    const docs =
      fetchAll
        ? await Message.find(query).sort({ createdAt: 1 })
        : await Message.find(query).sort(sort).limit(limit);

    const ordered = fetchLast || before ? docs.reverse() : docs;

    const messages = ordered.map((msg: any) => ({
      id: String(msg._id),
      from: String(msg.from),
      to: String(msg.to),
      type: msg.type,
      text: msg.text || "",
      mediaUrl: msg.mediaUrl || "",
      fileName: msg.fileName || "",
      fileSize: msg.fileSize || "",
      duration: msg.duration || undefined,
      linkTitle: msg.linkTitle || "",
      linkDescription: msg.linkDescription || "",
      timestamp: msg.createdAt,
      status: msg.status || "sent",
    }));

    const hasMore = fetchAll
      ? false
      : await Message.countDocuments({
          ...query,
          ...(before && { createdAt: { $lt: new Date(before) } }),
        }) > docs.length;

    return NextResponse.json({ messages, hasMore });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { peerId: string } }) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let session: any;
    try {
      session = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rawUserId = String(session.id || "");
    const rawPeerId = String(params.peerId || "");
    const effectiveUser = rawUserId
    if (!Types.ObjectId.isValid(effectiveUser) || !Types.ObjectId.isValid(rawPeerId)) {
      return NextResponse.json({ error: "Invalid user or peer id" }, { status: 400 })
    }
    const userId = new Types.ObjectId(effectiveUser)
    const peerId = new Types.ObjectId(rawPeerId)

    const body = await req.json();
    const type = String(body?.type || "text");

    await connectDB();

    const exists = await User.exists({ _id: peerId });
    if (!exists) return NextResponse.json({ error: "Peer not found" }, { status: 404 });

    const saved = await Message.create({
      from: userId,
      to: peerId,
      type,
      text: body?.text || "",
      mediaUrl: body?.mediaUrl || "",
      fileName: body?.fileName || "",
      fileSize: body?.fileSize || "",
      duration: body?.duration || undefined,
      linkTitle: body?.linkTitle || "",
      linkDescription: body?.linkDescription || "",
    });

    try {
      const a = String(userId);
      const b = String(peerId);
      const userA = a < b ? a : b;
      const userB = a < b ? b : a;

      await Conversation.findOneAndUpdate(
        { userA, userB },
        { lastMessageAt: new Date() },
        { upsert: true }
      );
    } catch {}

    const message = {
      id: String(saved._id),
      from: String(saved.from),
      to: String(saved.to),
      type: saved.type,
      text: saved.text || "",
      mediaUrl: saved.mediaUrl || "",
      fileName: saved.fileName || "",
      fileSize: saved.fileSize || "",
      duration: saved.duration || undefined,
      linkTitle: saved.linkTitle || "",
      linkDescription: saved.linkDescription || "",
      timestamp: saved.createdAt,
      status: "sent",
    };

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || "Server error" }, { status: 500 });
  }
}
