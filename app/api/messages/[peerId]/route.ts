import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import User from "@/models/user/User";
import { requireUser, parseJson } from "@/lib/api/request";
import {
  encryptDirectMessageContent,
  decryptDirectMessageContent,
} from "@/lib/crypto";
import {
  CacheKeys,
  TTL,
  redisGet,
  redisSet,
  invalidateDirectMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import {
  emitDirectMessageReceived,
  emitDirectMessageUpdated,
} from "@/lib/socketEmitter";

const outboundMessageSchema = z.object({
  type: z.enum(["text", "image", "video", "voice", "pdf", "excel", "link", "file"]),
  clientMessageId: z.string().min(1).max(100).optional(),
  text: z.string().max(10000).optional().default(""),
  mediaUrl: z.string().url().optional().or(z.literal("")),
  fileName: z.string().max(255).optional().or(z.literal("")),
  fileSize: z.string().max(32).optional().or(z.literal("")),
  duration: z.number().finite().min(0).max(3600).optional(),
  viewOnce: z.boolean().optional().default(false),
  linkTitle: z.string().max(500).optional().or(z.literal("")),
  linkDescription: z.string().max(5000).optional().or(z.literal("")),
});

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

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;

    const session = await requireUser(req);
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

    if (!fetchAll) {
      const cacheKey = CacheKeys.directMessagesPage(
        rawUserId,
        rawPeerId,
        limit,
        fetchLast ? null : before,
      );
      const cached = await redisGet<{ messages: any[]; hasMore: boolean }>(
        cacheKey,
      );
      if (cached && Array.isArray(cached.messages)) {
        return NextResponse.json(cached);
      }
    }

    const query: any = {
      hiddenFor: { $ne: userId },
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
      clientMessageId: msg.clientMessageId,
      from: String(msg.from),
      to: String(msg.to),
      type: msg.deletedForEveryone ? "text" : msg.type,
      text: msg.deletedForEveryone
        ? ""
        : decryptDirectMessageContent(userIdStr, peerIdStr, msg.text || ""),
      mediaUrl:
        msg.deletedForEveryone || msg.viewOnce
          ? ""
          : decryptDirectMessageContent(
              userIdStr,
              peerIdStr,
              msg.mediaUrl || "",
            ),
      fileName: msg.deletedForEveryone
        ? ""
        : decryptDirectMessageContent(userIdStr, peerIdStr, msg.fileName || ""),
      fileSize: msg.deletedForEveryone
        ? ""
        : decryptDirectMessageContent(userIdStr, peerIdStr, msg.fileSize || ""),
      duration: msg.duration || undefined,
      reactions:
        msg.reactions instanceof Map
          ? Object.fromEntries(msg.reactions)
          : msg.reactions || {},
      linkTitle: msg.deletedForEveryone
        ? ""
        : decryptDirectMessageContent(userIdStr, peerIdStr, msg.linkTitle || ""),
      linkDescription: msg.deletedForEveryone
        ? ""
        : decryptDirectMessageContent(
            userIdStr,
            peerIdStr,
            msg.linkDescription || "",
          ),
      buttons: msg.buttons || [],
      timestamp: msg.createdAt,
      status: msg.status || "sent",
      deletedForEveryone: Boolean(msg.deletedForEveryone),
      viewOnce: Boolean(msg.viewOnce),
      viewedByMe: Array.isArray(msg.viewedBy)
        ? msg.viewedBy.some((viewer: unknown) => String(viewer) === rawUserId)
        : false,
      viewed: Array.isArray(msg.viewedBy) && msg.viewedBy.length > 0,
    }));

    const hasMore = fetchAll
      ? false
      : (await Message.countDocuments({
          ...query,
          ...(before && { createdAt: { $lt: new Date(before) } }),
        })) > docs.length;

    if (!fetchAll) {
      const cacheKey = CacheKeys.directMessagesPage(
        rawUserId,
        rawPeerId,
        limit,
        fetchLast ? null : before,
      );
      void redisSet(cacheKey, { messages, hasMore }, TTL.messages);
    }

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

    const session = await requireUser(req);
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

    const parsedBody = await parseJson(req, outboundMessageSchema);
    if (!parsedBody.success) return parsedBody.response;
    const body = parsedBody.data;
    const type = body.type;
    if (
      body.viewOnce &&
      !["image", "video", "voice"].includes(type)
    ) {
      return NextResponse.json(
        { error: "View-once is only available for photos, videos, and voice notes" },
        { status: 400 },
      );
    }

    await connectDB();

    const exists = await User.exists({ _id: peerId });
    if (!exists)
      return NextResponse.json({ error: "Peer not found" }, { status: 404 });

    const userIdStr = String(userId);
    const peerIdStr = String(peerId);

    const messageQuery = {
      from: userId,
      to: peerId,
      clientMessageId: body.clientMessageId,
    };
    let saved = body.clientMessageId
      ? await Message.findOne(messageQuery)
      : null;
    let isNewMessage = !saved;
    if (!saved) {
      try {
        saved = await Message.create({
          ...messageQuery,
          type,
          viewOnce: body.viewOnce,
          text: encryptDirectMessageContent(
            userIdStr,
            peerIdStr,
            body?.text || "",
          ),
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
      } catch (error: unknown) {
        if (!body.clientMessageId || !isDuplicateKeyError(error)) throw error;
        saved = await Message.findOne(messageQuery);
        if (!saved) throw error;
        isNewMessage = false;
      }
    }

    if (isNewMessage) {
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
    }

    const message = {
      _id: saved._id,
      id: String(saved._id),
      clientMessageId: saved.clientMessageId,
      from: String(saved.from),
      to: String(saved.to),
      type: saved.type,
      text: decryptDirectMessageContent(userIdStr, peerIdStr, saved.text || ""),
      mediaUrl: body.viewOnce
        ? ""
        : decryptDirectMessageContent(
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
      status: saved.status || "sent",
    };

    if (isNewMessage) {
      void invalidateDirectMessages(rawUserId, rawPeerId);
      void invalidateUserConversations(rawUserId);
      void invalidateUserConversations(rawPeerId);
      void emitDirectMessageReceived(rawUserId, rawPeerId, message);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Server error" },
      { status: 500 },
    );
  }
}

const ALLOWED_REACTIONS = new Set([
  "👍",
  "❤️",
  "😂",
  "😮",
  "😢",
  "🔥",
  "✨",
  "🎉",
  "💯",
  "🤝",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const session = await requireUser(req);
    if (!session?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = normalizeId(session.id);
    const peerId = normalizeId(resolvedParams.peerId);
    const body = await req.json();
    const messageId = normalizeId(body?.messageId);
    const emoji = String(body?.emoji || "");
    const action = String(body?.action || "");

    if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(peerId)) {
      return NextResponse.json(
        { error: "Invalid participant" },
        { status: 400 },
      );
    }
    if (!Types.ObjectId.isValid(messageId)) {
      return NextResponse.json({ error: "Invalid message id" }, { status: 400 });
    }

    await connectDB();

    if (action === "viewOnce") {
      const viewed = await Message.findOneAndUpdate(
        {
          _id: new Types.ObjectId(messageId),
          from: new Types.ObjectId(peerId),
          to: new Types.ObjectId(userId),
          viewOnce: true,
          deletedForEveryone: { $ne: true },
          viewedBy: { $ne: new Types.ObjectId(userId) },
        },
        { $addToSet: { viewedBy: new Types.ObjectId(userId) } },
        { new: true },
      );
      if (!viewed) {
        return NextResponse.json(
          { error: "This view-once message has already been opened or is unavailable" },
          { status: 410 },
        );
      }

      const mediaUrl = decryptDirectMessageContent(
        peerId,
        userId,
        viewed.mediaUrl || "",
      );
      void invalidateDirectMessages(userId, peerId);
      void emitDirectMessageUpdated(userId, peerId, {
        _id: String(viewed._id),
        id: String(viewed._id),
        from: String(viewed.from),
        to: String(viewed.to),
        viewOnce: true,
        viewedBy: (viewed.viewedBy || []).map(String),
      });
      return NextResponse.json({ mediaUrl });
    }

    if (action) {
      return NextResponse.json({ error: "Invalid message action" }, { status: 400 });
    }

    if (!ALLOWED_REACTIONS.has(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

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

    if (!updated)
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    void invalidateDirectMessages(userId, peerId);
    return NextResponse.json({
      reactions: Object.fromEntries(updated.reactions?.entries?.() ?? []),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ peerId: string }> | { peerId: string } },
) {
  try {
    const session = await requireUser(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = params instanceof Promise ? await params : params;
    const userId = normalizeId(session.id);
    const peerId = normalizeId(resolvedParams.peerId);
    const body = await req.json();
    const messageId = normalizeId(body?.messageId);
    const action = body?.action;

    if (
      !Types.ObjectId.isValid(userId) ||
      !Types.ObjectId.isValid(peerId) ||
      !Types.ObjectId.isValid(messageId) ||
      !["forMe", "forEveryone"].includes(action)
    ) {
      return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
    }

    await connectDB();
    const baseQuery = {
      _id: new Types.ObjectId(messageId),
      $or: [
        { from: new Types.ObjectId(userId), to: new Types.ObjectId(peerId) },
        { from: new Types.ObjectId(peerId), to: new Types.ObjectId(userId) },
      ],
      deletedForEveryone: { $ne: true },
    };
    const update =
      action === "forMe"
        ? { $addToSet: { hiddenFor: new Types.ObjectId(userId) } }
        : {
            $set: {
              deletedForEveryone: true,
              type: "text",
              text: "",
              mediaUrl: "",
              fileName: "",
              fileSize: "",
              linkTitle: "",
              linkDescription: "",
            },
            $unset: { reactions: 1, buttons: 1 },
          };
    const query =
      action === "forEveryone"
        ? { ...baseQuery, from: new Types.ObjectId(userId) }
        : baseQuery;
    const updated = await Message.findOneAndUpdate(query, update, { new: true });

    if (!updated) {
      return NextResponse.json(
        { error: "Message not found or you are not allowed to delete it" },
        { status: 404 },
      );
    }

    void invalidateDirectMessages(userId, peerId);
    void invalidateUserConversations(userId);
    void invalidateUserConversations(peerId);

    if (action === "forEveryone") {
      void emitDirectMessageUpdated(userId, peerId, {
        _id: String(updated._id),
        id: String(updated._id),
        from: String(updated.from),
        to: String(updated.to),
        type: "text",
        text: "",
        deletedForEveryone: true,
        timestamp: updated.createdAt,
      });
    }

    return NextResponse.json({
      messageId: String(updated._id),
      action,
      deletedForEveryone: Boolean(updated.deletedForEveryone),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
