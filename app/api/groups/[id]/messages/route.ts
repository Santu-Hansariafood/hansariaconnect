import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Group from "@/models/group/Group";
import GroupMessage from "@/models/group/GroupMessage";
import { getUserSession } from "@/lib/sessionAuth";
import {
  encryptGroupMessageContent,
  decryptGroupMessageContent,
} from "@/lib/crypto";
import {
  CacheKeys,
  TTL,
  redisGet,
  redisSet,
  invalidateGroupMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";

interface GroupMember {
  userId: Types.ObjectId | string;
  [key: string]: any;
}

interface GroupDoc {
  _id: Types.ObjectId;
  members: GroupMember[];
  [key: string]: any;
}

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val;
  if (val == null) return "";
  if (["number", "bigint", "boolean"].includes(typeof val)) return String(val);
  if (typeof val === "object") {
    const obj = val as { toString?: () => string; $oid?: unknown };
    if (typeof obj.$oid === "string") return obj.$oid;
    if (typeof obj.toString === "function") {
      const str = obj.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return "";
};

const resolveParams = async (
  params: { id: string } | Promise<{ id: string }>,
) => {
  return params instanceof Promise ? await params : params;
};

const ensureMembership = async (
  groupId: Types.ObjectId,
  userId: Types.ObjectId,
) => {
  const group = await Group.findById(groupId).lean<GroupDoc>();
  if (!group)
    return {
      ok: false as const,
      status: 404 as const,
      error: "Group not found",
    };

  const members = Array.isArray(group.members) ? group.members : [];
  const member = members.find(
    (entry) => String(entry.userId) === String(userId),
  );
  if (!member)
    return { ok: false as const, status: 403 as const, error: "Access denied" };
  return { ok: true as const, group, member };
};

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await resolveParams(context.params);
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const normalizedUser = normalizeId(session.id);
    if (!Types.ObjectId.isValid(normalizedUser)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const groupId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(normalizedUser);
    const groupIdStr = String(groupId);

    await connectDB();

    const membership = await ensureMembership(groupId, userId);
    if (!membership.ok) {
      return NextResponse.json(
        { error: membership.error },
        { status: membership.status },
      );
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
      const cacheKey = CacheKeys.groupMessagesPage(
        groupIdStr,
        limit,
        fetchLast ? null : before,
      );
      const cached = await redisGet<{ messages: any[]; hasMore: boolean }>(cacheKey);
      if (cached && Array.isArray(cached.messages)) {
        return NextResponse.json(cached);
      }
    }

    const query: Record<string, any> = { groupId };
    let sort: Record<string, 1 | -1> = { createdAt: 1 };

    if (fetchLast && !fetchAll) {
      sort = { createdAt: -1 };
    } else if (before) {
      query.createdAt = { $lt: new Date(before) };
      sort = { createdAt: -1 };
    }

    const docs = fetchAll
      ? await GroupMessage.find(query)
          .sort({ createdAt: 1 })
          .select(
            "_id groupId from type text mediaUrl fileName fileSize duration reactions linkTitle linkDescription createdAt",
          )
      : await GroupMessage.find(query)
          .sort(sort)
          .limit(limit)
          .select(
            "_id groupId from type text mediaUrl fileName fileSize duration linkTitle linkDescription createdAt",
          );

    const ordered = (fetchLast && !fetchAll) || before ? docs.reverse() : docs;

    const messages = ordered.map((msg) => ({
      id: String(msg._id),
      groupId: String(msg.groupId),
      from: String(msg.from),
      type: msg.type,
      text: decryptGroupMessageContent(groupIdStr, msg.text || ""),
      mediaUrl: decryptGroupMessageContent(groupIdStr, msg.mediaUrl || ""),
      fileName: decryptGroupMessageContent(groupIdStr, msg.fileName || ""),
      fileSize: decryptGroupMessageContent(groupIdStr, msg.fileSize || ""),
      duration: msg.duration || undefined,
      reactions:
        msg.reactions instanceof Map
          ? Object.fromEntries(msg.reactions)
          : msg.reactions || {},
      linkTitle: decryptGroupMessageContent(groupIdStr, msg.linkTitle || ""),
      linkDescription: decryptGroupMessageContent(
        groupIdStr,
        msg.linkDescription || "",
      ),
      timestamp: msg.createdAt,
    }));

    const hasMore = fetchAll
      ? false
      : (await GroupMessage.countDocuments({
          ...query,
          ...(before && { createdAt: { $lt: new Date(before) } }),
        })) > docs.length;

    if (!fetchAll) {
      const cacheKey = CacheKeys.groupMessagesPage(
        groupIdStr,
        limit,
        fetchLast ? null : before,
      );
      void redisSet(cacheKey, { messages, hasMore }, TTL.groupMessages);
    }

    return NextResponse.json({ messages, hasMore });
  } catch (error: unknown) {
    console.error("GET /api/groups/[id]/messages error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await resolveParams(context.params);
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const normalizedUser = normalizeId(session.id);
    if (!Types.ObjectId.isValid(normalizedUser)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const groupId = new Types.ObjectId(id);
    const userId = new Types.ObjectId(normalizedUser);
    const groupIdStr = String(groupId);

    const body = await req.json();
    const type = String(body?.type || "text");

    await connectDB();

    const membership = await ensureMembership(groupId, userId);
    if (!membership.ok) {
      return NextResponse.json(
        { error: membership.error },
        { status: membership.status },
      );
    }

    const saved = await GroupMessage.create({
      groupId,
      from: userId,
      type,
      text: encryptGroupMessageContent(groupIdStr, body?.text || ""),
      mediaUrl: encryptGroupMessageContent(groupIdStr, body?.mediaUrl || ""),
      fileName: encryptGroupMessageContent(groupIdStr, body?.fileName || ""),
      fileSize: encryptGroupMessageContent(groupIdStr, body?.fileSize || ""),
      duration: body?.duration || undefined,
      linkTitle: encryptGroupMessageContent(groupIdStr, body?.linkTitle || ""),
      linkDescription: encryptGroupMessageContent(
        groupIdStr,
        body?.linkDescription || "",
      ),
    });

    await Group.findByIdAndUpdate(groupId, {
      lastMessage: body?.text || type,
      lastMessageAt: new Date(),
    }).catch(() => {});

    const message = {
      id: String(saved._id),
      groupId: String(saved.groupId),
      from: String(saved.from),
      type: saved.type,
      text: decryptGroupMessageContent(groupIdStr, saved.text || ""),
      mediaUrl: decryptGroupMessageContent(groupIdStr, saved.mediaUrl || ""),
      fileName: decryptGroupMessageContent(groupIdStr, saved.fileName || ""),
      fileSize: decryptGroupMessageContent(groupIdStr, saved.fileSize || ""),
      duration: saved.duration || undefined,
      linkTitle: decryptGroupMessageContent(groupIdStr, saved.linkTitle || ""),
      linkDescription: decryptGroupMessageContent(
        groupIdStr,
        saved.linkDescription || "",
      ),
      timestamp: saved.createdAt,
    };

    void invalidateGroupMessages(groupIdStr);
    const members = Array.isArray(membership.group?.members) ? membership.group.members : [];
    for (const m of members) {
      const memberId = normalizeId(m?.userId);
      if (memberId) void invalidateUserConversations(memberId);
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error: unknown) {
    console.error("POST /api/groups/[id]/messages error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const ALLOWED_REACTIONS = new Set(["👍", "❤️", "😂", "😮", "😢", "🔥", "✨", "🎉", "💯", "🤝"]);

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
    if (!session?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await resolveParams(context.params);
    const userId = normalizeId(session.id);
    const body = await req.json();
    const messageId = normalizeId(body?.messageId);
    const emoji = String(body?.emoji || "");

    if (!Types.ObjectId.isValid(id) || !Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "Invalid group or user" }, { status: 400 });
    }
    if (!Types.ObjectId.isValid(messageId) || !ALLOWED_REACTIONS.has(emoji)) {
      return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
    }

    await connectDB();
    const membership = await ensureMembership(
      new Types.ObjectId(id),
      new Types.ObjectId(userId),
    );
    if (!membership.ok) {
      return NextResponse.json(
        { error: membership.error },
        { status: membership.status },
      );
    }

    const updated = await GroupMessage.findOneAndUpdate(
      { _id: new Types.ObjectId(messageId), groupId: new Types.ObjectId(id) },
      { $inc: { [`reactions.${emoji}`]: 1 } },
      { new: true },
    );
    if (!updated) return NextResponse.json({ error: "Message not found" }, { status: 404 });
    void invalidateGroupMessages(id);
    return NextResponse.json({
      reactions: Object.fromEntries(updated.reactions?.entries?.() ?? []),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
