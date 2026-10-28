import type { Server as ServerIO } from "socket.io";
import { Types } from "mongoose";

import Message from "@/models/message/Message";
import GroupMessage from "@/models/group/GroupMessage";
import ReadReceipt from "@/models/readReceipt/ReadReceipt";
import Conversation from "@/models/conversation/Conversation";
import Group from "@/models/group/Group";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import Contact from "@/models/contact/Contact";
import type { TemplateActionButton } from "@/lib/templateActionButtons";

import {
  getRedis,
  invalidateDirectMessages,
  invalidateGroupMessages,
  invalidateUserConversations,
} from "@/lib/redis/redis";
import { publishSocketRoomEvent } from "@/lib/socketRedisAdapter";
import { isUserActivelyViewing } from "@/lib/presence";
import { pushIfNotViewing, type PushPayload } from "@/lib/webPush";
import {
  clearAllUnread,
  clearChatUnread,
  incrDirectUnread,
  incrGroupUnread,
  readUnread,
  writeUnread,
  type UnreadPayload,
} from "@/lib/unreadCounters";

type ContactLean = {
  name?: string;
  mobiles?: string[];
};

type ConversationLean = {
  _id: Types.ObjectId;
  userA: Types.ObjectId;
  userB: Types.ObjectId;
};

type GroupLean = {
  _id?: Types.ObjectId | string;
  name?: string;
  avatar?: string;
};

type ReadReceiptLean = {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  groupId?: Types.ObjectId;
  readAt?: Date;
};

type SenderUserLean = {
  _id?: Types.ObjectId | string;
  mobile?: string;
  name?: string;
};

type SenderProfileLean = {
  name?: string;
  photo?: string;
};

type SenderInfo = {
  user: SenderUserLean | null;
  profile: SenderProfileLean | null;
};

type DecryptedMessage = {
  _id?: Types.ObjectId;
  id?: string;
  type: string;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number;
  linkDescription?: string;
  linkTitle?: string;
  buttons?: TemplateActionButton[];
  createdAt?: Date;
  timestamp?: Date;
};

type IncomingNotificationPayload = {
  kind: "direct" | "group";
  chatId: string;
  messageId?: string;
  chatName: string;
  chatAvatar?: string;
  fromUserId: string;
  fromName: string;
  fromAvatar?: string;
  preview: string;
  messageType: string;
  /** Lets the client show the actual photo/video as the notification image. */
  mediaUrl?: string;
  timestamp: Date | string;
  unreadCounts?: UnreadPayload;
};

type NotificationMeta = Omit<IncomingNotificationPayload, "unreadCounts">;

type AdminNotificationPayload = Pick<
  IncomingNotificationPayload,
  | "kind"
  | "chatId"
  | "chatName"
  | "chatAvatar"
  | "fromUserId"
  | "fromName"
  | "fromAvatar"
  | "timestamp"
>;

const EMPTY_UNREAD: UnreadPayload = Object.freeze({
  total: 0,
  conversations: {},
  groups: {},
});

const DEFAULT_AVATAR = "/logo/logo.png";
const META_CACHE_TTL_SECONDS = 300;
const FAN_OUT_CONCURRENCY = 20;
const DEBUG = process.env.SOCKET_DEBUG === "1";
let activeFanOut = 0;
const fanOutWaiters: Array<() => void> = [];

const debugLog = (...args: unknown[]) => {
  if (DEBUG) console.log(...args);
};

const errMsg = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const withFanOutSlot = async (work: () => Promise<void>): Promise<void> => {
  if (activeFanOut >= FAN_OUT_CONCURRENCY) {
    await new Promise<void>((resolve) => fanOutWaiters.push(resolve));
  } else {
    activeFanOut += 1;
  }

  try {
    await work();
  } finally {
    const next = fanOutWaiters.shift();
    if (next) {
      next();
    } else {
      activeFanOut -= 1;
    }
  }
};

let socketBootstrap: Promise<void> | null = null;

const getIo = async (): Promise<ServerIO | null> => {
  const getCurrentIo = () =>
    (globalThis as typeof globalThis & { __io?: ServerIO }).__io;
  const currentIo = getCurrentIo();
  if (currentIo) return currentIo;

  if (!socketBootstrap) {
    const port = process.env.PORT || "4000";
    socketBootstrap = fetch(
      `http://127.0.0.1:${port}/api/socket?t=${Date.now()}`,
      { method: "GET", cache: "no-store" },
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Socket bootstrap returned HTTP ${response.status}`);
        }
      })
      .catch((error) => {
        socketBootstrap = null;
        console.error(
          "[socketEmitter] Could not initialize the local Socket.IO server:",
          errMsg(error),
        );
      });
  }

  await socketBootstrap;
  return getCurrentIo() ?? null;
};

export const disconnectUserSession = async (
  sessionId: string,
): Promise<void> => {
  try {
    const io = await getIo();
    if (!io) return;
    const room = `user-session:${sessionId}`;
    io.to(room).emit("session:revoked");
    io.in(room).disconnectSockets(true);
  } catch (error) {
    console.error(
      "[socketEmitter] Could not disconnect revoked session:",
      errMsg(error),
    );
  }
};

const emitRoomEvent = async (
  io: ServerIO | null,
  room: string,
  event: string,
  payload: unknown,
): Promise<void> => {
  try {
    const published = await publishSocketRoomEvent(room, event, payload);
    if (published) return;
  } catch (error) {
    console.error(
      `[socketEmitter] Redis publish failed for ${event}:`,
      errMsg(error),
    );
  }

  if (io) {
    io.to(room).emit(event, payload);
  } else {
    console.error(
      `[socketEmitter] Could not deliver ${event} to ${room}: Socket.IO server is unavailable`,
    );
  }
};

const normalizeMobile = (value?: string | null): string => {
  return String(value || "").replace(/\D/g, "");
};

const toObjectId = (value: string): Types.ObjectId | null => {
  if (!Types.ObjectId.isValid(value)) {
    return null;
  }

  return new Types.ObjectId(value);
};

const forEachConcurrent = async <T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> => {
  let nextIndex = 0;
  const workerCount = Math.min(items.length, Math.max(1, concurrency));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const item = items[nextIndex++];

        try {
          await withFanOutSlot(() => fn(item));
        } catch (error) {
          console.error("[socketEmitter] fan-out item failed:", errMsg(error));
        }
      }
    }),
  );
};

const getCached = async <T>(
  cacheKey: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> => {
  const client = await getRedis();

  try {
    if (client) {
      const hit = await client.get(cacheKey);
      if (hit) return JSON.parse(hit) as T;
    }
  } catch (error) {
    console.error("[socketEmitter] cache read failed:", errMsg(error));
  }

  const value = await loader();

  if (client) {
    try {
      await client.set(cacheKey, JSON.stringify(value), "EX", ttlSeconds);
    } catch (error) {
      console.error("[socketEmitter] cache write failed:", errMsg(error));
    }
  }

  return value;
};

const MAX_PREVIEW_LENGTH = 140;

const truncatePreview = (value: string) =>
  value.length > MAX_PREVIEW_LENGTH
    ? `${value.slice(0, MAX_PREVIEW_LENGTH)}…`
    : value;

/**
 * WhatsApp shows what *kind* of message arrived before the text does, so every
 * media type gets its own label instead of falling through to "New message".
 */
const buildPreview = (
  message: Pick<
    DecryptedMessage,
    "type" | "text" | "fileName" | "linkTitle"
  >,
): string => {
  const caption = (message.text || "").trim();
  const withCaption = (label: string) =>
    truncatePreview(caption ? `${label} · ${caption}` : label);

  switch (message.type) {
    case "image":
      return withCaption("📷 Photo");

    case "video":
      return withCaption("🎥 Video");

    case "voice":
      return withCaption("🎤 Voice message");

    case "pdf":
      return withCaption(`📄 ${message.fileName || "Document"}`);

    case "excel":
      return withCaption(`📊 ${message.fileName || "Spreadsheet"}`);

    case "file":
      return withCaption(`📎 ${message.fileName || "File"}`);

    case "link":
      return truncatePreview(
        `🔗 ${message.linkTitle || message.text || "Link"}`,
      );

    case "text":
    default: {
      const text = (message.text || "").trim();

      return truncatePreview(text || "New message");
    }
  }
};

/** Only visual media is worth using as a notification thumbnail. */
const notificationMedia = (
  message: Pick<DecryptedMessage, "type" | "mediaUrl">,
): string | undefined =>
  message.type === "image" || message.type === "video"
    ? message.mediaUrl || undefined
    : undefined;

const toAdminNotification = (
  notification: NotificationMeta,
): AdminNotificationPayload => ({
  kind: notification.kind,
  chatId: notification.chatId,
  chatName: notification.chatName,
  chatAvatar: notification.chatAvatar,
  fromUserId: notification.fromUserId,
  fromName: notification.fromName,
  fromAvatar: notification.fromAvatar,
  timestamp: notification.timestamp,
});

const getMessageId = (message: DecryptedMessage): string | undefined =>
  message.id || String(message._id ?? "") || undefined;

/**
 * Mirrors what the in-app notification shows, so a push raised while the app is
 * closed reads exactly like the one the user sees while it is open.
 */
const toPushPayload = (notification: NotificationMeta): PushPayload => ({
  title:
    notification.kind === "group"
      ? `${notification.fromName} in ${notification.chatName}`
      : notification.fromName || notification.chatName || "New message",
  body: notification.preview || "You have a new message",
  // Same tag the client uses, so a follow-up message replaces the entry in the
  // notification tray instead of stacking a second one for the same chat.
  tag: `${notification.kind}-${notification.chatId}`,
  url:
    notification.kind === "direct"
      ? `/chat/${notification.chatId}`
      : `/chat/${notification.chatId}?group=true`,
  image: notification.mediaUrl,
});

const computeDirectUnread = async (
  userId: Types.ObjectId,
): Promise<Record<string, number>> => {
  const conversations = (await Conversation.find({
    $or: [{ userA: userId }, { userB: userId }],
  })
    .select("_id userA userB")
    .lean()) as ConversationLean[];

  if (conversations.length === 0) {
    return {};
  }

  const conversationIds = conversations.map((conversation) => conversation._id);

  const receipts = (await ReadReceipt.find({
    userId,
    conversationId: { $in: conversationIds },
  })
    .select("conversationId readAt")
    .lean()) as ReadReceiptLean[];

  const receiptMap = new Map<string, Date>();

  for (const receipt of receipts) {
    if (!receipt.conversationId) continue;

    receiptMap.set(
      String(receipt.conversationId),
      receipt.readAt ?? new Date(0),
    );
  }

  const conditions: Array<{
    from: Types.ObjectId;
    to: Types.ObjectId;
    createdAt: { $gt: Date };
    status: { $ne: "seen" };
  }> = [];

  const peerIds = new Set<string>();

  for (const conversation of conversations) {
    const peerId =
      String(conversation.userA) === String(userId)
        ? conversation.userB
        : conversation.userA;

    const lastReadAt = receiptMap.get(String(conversation._id)) ?? new Date(0);

    peerIds.add(String(peerId));

    conditions.push({
      from: peerId,
      to: userId,
      createdAt: { $gt: lastReadAt },
      status: { $ne: "seen" },
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  const results = await Message.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { $or: conditions } },
    { $group: { _id: "$from", count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};

  for (const result of results) {
    const peerId = String(result._id);

    if (peerIds.has(peerId) && result.count > 0) {
      counts[peerId] = result.count;
    }
  }

  return counts;
};

const computeGroupUnread = async (
  userId: Types.ObjectId,
): Promise<Record<string, number>> => {
  const groups = (await Group.find({
    "members.userId": userId,
  })
    .select("_id")
    .lean()) as Array<{ _id: Types.ObjectId }>;

  if (groups.length === 0) {
    return {};
  }

  const groupIds = groups.map((group) => group._id);

  const receipts = (await ReadReceipt.find({
    userId,
    groupId: { $in: groupIds },
    groupMessageId: { $exists: false },
  })
    .select("groupId readAt")
    .lean()) as ReadReceiptLean[];

  const receiptMap = new Map<string, Date>();

  for (const receipt of receipts) {
    if (!receipt.groupId) continue;

    receiptMap.set(String(receipt.groupId), receipt.readAt ?? new Date(0));
  }

  const conditions: Array<{
    groupId: Types.ObjectId;
    from: { $ne: Types.ObjectId };
    createdAt: { $gt: Date };
  }> = [];

  for (const group of groups) {
    const lastReadAt = receiptMap.get(String(group._id)) ?? new Date(0);

    conditions.push({
      groupId: group._id,
      from: { $ne: userId },
      createdAt: { $gt: lastReadAt },
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  const results = await GroupMessage.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    { $match: { $or: conditions } },
    {
      $lookup: {
        from: ReadReceipt.collection.name,
        let: { messageId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$groupMessageId", "$$messageId"] },
                  { $eq: ["$userId", userId] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "userReadReceipts",
      },
    },
    { $match: { "userReadReceipts.0": { $exists: false } } },
    { $group: { _id: "$groupId", count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};

  for (const result of results) {
    if (result.count > 0) {
      counts[String(result._id)] = result.count;
    }
  }

  return counts;
};

export const getUnreadCountsForUser = async (
  rawUserId: string,
): Promise<UnreadPayload | null> => {
  const userId = toObjectId(rawUserId);

  if (!userId) {
    return EMPTY_UNREAD;
  }

  try {
    const cached = await readUnread(rawUserId);
    if (cached) return cached;
  } catch (error) {
    console.error("[socketEmitter] unread cache read failed:", errMsg(error));
  }

  try {
    const [conversations, groups] = await Promise.all([
      computeDirectUnread(userId),
      computeGroupUnread(userId),
    ]);

    const payload: UnreadPayload = {
      total:
        Object.values(conversations).reduce((sum, count) => sum + count, 0) +
        Object.values(groups).reduce((sum, count) => sum + count, 0),
      conversations,
      groups,
    };

    try {
      await writeUnread(rawUserId, payload);
    } catch (error) {
      console.error(
        "[socketEmitter] unread cache write failed:",
        errMsg(error),
      );
    }

    return payload;
  } catch (error) {
    console.error("[socketEmitter] unread compute failed:", errMsg(error));
    return null;
  }
};

/**
 * Backend refresh trigger for a single user id.
 *
 * Anything that "hits" an id — a direct message, a group fan-out, a read
 * receipt — must leave that id's server state consistent and tell its live
 * sockets to re-sync. This is the single funnel for that: drop the id's cached
 * conversation list, push a server-authoritative `conversation:updated` so the
 * sidebar re-fetches from the backend, then push the authoritative unread
 * counters. Clients never need a manual page refresh to see the change.
 */
const refreshUserId = async (
  io: ServerIO | null,
  rawUserId: string,
  chat: { chatId: string; isGroup: boolean; changedAt: Date },
  knownCounts?: UnreadPayload | null,
): Promise<UnreadPayload | null> => {
  if (!toObjectId(rawUserId)) {
    return knownCounts ?? null;
  }

  const signals = await Promise.allSettled([
    invalidateUserConversations(rawUserId),
    emitRoomEvent(io, rawUserId, "conversation:updated", {
      peerId: chat.chatId,
      ...(chat.isGroup ? { groupId: chat.chatId } : {}),
      isGroup: chat.isGroup,
      createdAt: chat.changedAt,
    }),
  ]);

  for (const signal of signals) {
    if (signal.status === "rejected") {
      console.error(
        "[socketEmitter] user refresh signal failed:",
        errMsg(signal.reason),
      );
    }
  }

  const counts =
    knownCounts === undefined
      ? await getUnreadCountsForUser(rawUserId)
      : knownCounts;

  if (counts) {
    await emitRoomEvent(io, rawUserId, "unread:update", counts);
  }

  return counts ?? null;
};

const findSavedContactName = (
  contacts: ContactLean[],
  senderMobile?: string,
): string => {
  const normalizedSenderMobile = normalizeMobile(senderMobile);

  if (!normalizedSenderMobile) {
    return "";
  }

  for (const contact of contacts) {
    const contactName =
      typeof contact.name === "string" ? contact.name.trim() : "";

    if (!contactName || !Array.isArray(contact.mobiles)) {
      continue;
    }

    for (const mobile of contact.mobiles) {
      if (normalizeMobile(mobile) === normalizedSenderMobile) {
        return contactName;
      }
    }
  }

  return "";
};

const getSenderInfo = async (rawFromId: string): Promise<SenderInfo> => {
  return getCached<SenderInfo>(
    `meta:user:${rawFromId}`,
    META_CACHE_TTL_SECONDS,
    async () => {
      const fromId = new Types.ObjectId(rawFromId);

      const [user, profile] = await Promise.all([
        User.findById(fromId)
          .select("_id mobile name")
          .lean() as Promise<SenderUserLean | null>,
        Profile.findOne({ userId: fromId })
          .select("name photo")
          .lean() as Promise<SenderProfileLean | null>,
      ]);

      return { user, profile };
    },
  );
};

const getGroupInfo = async (rawGroupId: string): Promise<GroupLean | null> => {
  return getCached<GroupLean | null>(
    `meta:group:${rawGroupId}`,
    META_CACHE_TTL_SECONDS,
    async () =>
      (await Group.findById(rawGroupId)
        .select("name avatar")
        .lean()) as GroupLean | null,
  );
};

const buildDirectNotification = async (
  rawFromId: string,
  rawToId: string,
  decryptedMessage: DecryptedMessage,
): Promise<NotificationMeta | null> => {
  const toUserId = toObjectId(rawToId);

  if (!toObjectId(rawFromId) || !toUserId) {
    return null;
  }

  try {
    const [sender, myContacts] = await Promise.all([
      getSenderInfo(rawFromId),
      Contact.find({ userId: toUserId })
        .select("name mobiles")
        .lean() as Promise<ContactLean[]>,
    ]);

    const savedByName = findSavedContactName(myContacts, sender.user?.mobile);

    const senderName =
      savedByName ||
      sender.profile?.name ||
      sender.user?.name ||
      sender.user?.mobile ||
      "Unknown";

    const senderAvatar = sender.profile?.photo || DEFAULT_AVATAR;

    return {
      kind: "direct",
      chatId: rawFromId,
      messageId: getMessageId(decryptedMessage),
      chatName: senderName,
      chatAvatar: senderAvatar,
      fromUserId: rawFromId,
      fromName: senderName,
      fromAvatar: senderAvatar,
      preview: buildPreview(decryptedMessage),
      messageType: decryptedMessage.type,
      mediaUrl: notificationMedia(decryptedMessage),
      timestamp: decryptedMessage.createdAt ?? new Date(),
    };
  } catch (error) {
    console.error(
      "[socketEmitter] buildDirectNotification failed:",
      errMsg(error),
    );
    return {
      kind: "direct",
      chatId: rawFromId,
      messageId: getMessageId(decryptedMessage),
      chatName: "New message",
      chatAvatar: DEFAULT_AVATAR,
      fromUserId: rawFromId,
      fromName: "New message",
      fromAvatar: DEFAULT_AVATAR,
      preview: buildPreview(decryptedMessage),
      messageType: decryptedMessage.type,
      mediaUrl: notificationMedia(decryptedMessage),
      timestamp: decryptedMessage.createdAt ?? new Date(),
    };
  }
};

const buildGroupNotificationMeta = async (
  rawGroupId: string,
  rawFromId: string,
  decryptedMessage: DecryptedMessage,
): Promise<NotificationMeta | null> => {
  if (!toObjectId(rawGroupId) || !toObjectId(rawFromId)) {
    return null;
  }

  try {
    const [groupDoc, sender] = await Promise.all([
      getGroupInfo(rawGroupId),
      getSenderInfo(rawFromId),
    ]);

    const groupName = groupDoc?.name || "Group";
    const groupAvatar = groupDoc?.avatar || DEFAULT_AVATAR;

    const senderName =
      sender.profile?.name ||
      sender.user?.name ||
      sender.user?.mobile ||
      "Unknown";

    const senderAvatar = sender.profile?.photo || DEFAULT_AVATAR;

    return {
      kind: "group",
      chatId: rawGroupId,
      messageId: getMessageId(decryptedMessage),
      chatName: groupName,
      chatAvatar: groupAvatar,
      fromUserId: rawFromId,
      fromName: senderName,
      fromAvatar: senderAvatar,
      preview: `${senderName}: ${buildPreview(decryptedMessage)}`,
      messageType: decryptedMessage.type,
      mediaUrl: notificationMedia(decryptedMessage),
      timestamp: decryptedMessage.createdAt ?? new Date(),
    };
  } catch (error) {
    console.error(
      "[socketEmitter] buildGroupNotificationMeta failed:",
      errMsg(error),
    );
    return {
      kind: "group",
      chatId: rawGroupId,
      messageId: getMessageId(decryptedMessage),
      chatName: "Group",
      chatAvatar: DEFAULT_AVATAR,
      fromUserId: rawFromId,
      fromName: "New message",
      fromAvatar: DEFAULT_AVATAR,
      preview: `New message: ${buildPreview(decryptedMessage)}`,
      messageType: decryptedMessage.type,
      mediaUrl: notificationMedia(decryptedMessage),
      timestamp: decryptedMessage.createdAt ?? new Date(),
    };
  }
};

export const emitDirectMessageReceived = async (
  rawFromId: string,
  rawToId: string,
  decryptedMessage: DecryptedMessage,
): Promise<void> => {
  if (!toObjectId(rawFromId) || !toObjectId(rawToId)) {
    return;
  }

  try {
    const io = await getIo();

    await Promise.all([
      invalidateDirectMessages(rawFromId, rawToId),
      incrDirectUnread(rawToId, rawFromId).catch((error) =>
        console.error(
          "[socketEmitter] incrDirectUnread failed:",
          errMsg(error),
        ),
      ),
    ]);

    const deliver = Promise.all([
      emitRoomEvent(io, rawToId, "message:new", decryptedMessage),
      emitRoomEvent(io, rawFromId, "message:new", decryptedMessage),
    ]);

    const [recipientCounts, notification] = await Promise.all([
      getUnreadCountsForUser(rawToId),
      buildDirectNotification(rawFromId, rawToId, decryptedMessage),
      deliver,
    ]);

    /*
     * Backend trigger. Both ids were just hit by this message, so each one is
     * refreshed server-side (conversation-list cache dropped, re-sync signal
     * pushed, unread counters re-published). The sidebar updates itself — the
     * user never has to refresh the page to discover the new message.
     */
    const changedAt =
      decryptedMessage.createdAt ?? decryptedMessage.timestamp ?? new Date();

    await Promise.all([
      refreshUserId(
        io,
        rawToId,
        { chatId: rawFromId, isGroup: false, changedAt },
        recipientCounts,
      ),
      refreshUserId(io, rawFromId, {
        chatId: rawToId,
        isGroup: false,
        changedAt,
      }),
    ]);

    if (!notification) {
      console.warn(
        "[socketEmitter] direct notification unavailable - skipping notify",
      );
      return;
    }

    debugLog("[socketEmitter] message:notify ->", rawToId, {
      kind: notification.kind,
      from: notification.fromUserId,
    });

    await Promise.all([
      emitRoomEvent(io, rawToId, "message:notify", {
        ...notification,
        ...(recipientCounts ? { unreadCounts: recipientCounts } : {}),
      }),
      emitRoomEvent(
        io,
        `admin-notifications:${rawToId}`,
        "admin:message:notify",
        toAdminNotification(notification),
      ),
    ]);

    /*
     * Anything the socket could not alert — the app is minimised, backgrounded,
     * frozen by the OS, or closed — is reached over the internet as a Web Push
     * instead. Not awaited so the push round trip never delays delivery.
     */
    void pushIfNotViewing(
      rawToId,
      "direct",
      toPushPayload(notification),
      () => isUserActivelyViewing(rawToId),
    );
  } catch (error: unknown) {
    console.error(
      "[socketEmitter] emitDirectMessageReceived error:",
      errMsg(error),
    );
  }
};

/**
 * IMPORTANT: call this AFTER the group message has been saved to MongoDB.
 */
export const emitGroupMessageReceived = async (
  rawGroupId: string,
  rawFromId: string,
  members: Array<
    | string
    | {
        userId: string | Types.ObjectId;
      }
  >,
  decryptedMessage: DecryptedMessage,
): Promise<void> => {
  if (!toObjectId(rawGroupId) || !toObjectId(rawFromId)) {
    return;
  }

  try {
    const io = await getIo();

    await invalidateGroupMessages(rawGroupId);

    const memberIds = Array.from(
      new Set(
        members
          .map((member) =>
            typeof member === "string" ? member : String(member?.userId ?? ""),
          )
          .filter(
            (memberId): memberId is string =>
              Boolean(memberId) && Types.ObjectId.isValid(memberId),
          ),
      ),
    );

    const recipientIds = memberIds.filter((memberId) => memberId !== rawFromId);

    const changedAt =
      decryptedMessage.createdAt ?? decryptedMessage.timestamp ?? new Date();

    /*
     * Backend trigger for the sender. The sender's own id was hit by this
     * message too, so its conversation list is refreshed exactly like every
     * other member's.
     */
    await Promise.all([
      emitRoomEvent(io, rawFromId, "group:message:new", decryptedMessage),
      refreshUserId(io, rawFromId, {
        chatId: rawGroupId,
        isGroup: true,
        changedAt,
      }),
    ]);

    if (recipientIds.length === 0) {
      return;
    }

    const meta = await buildGroupNotificationMeta(
      rawGroupId,
      rawFromId,
      decryptedMessage,
    );

    debugLog(
      "[socketEmitter] group fan-out:",
      rawGroupId,
      `${recipientIds.length} recipients`,
    );

    const pushPayload = meta ? toPushPayload(meta) : null;

    await forEachConcurrent(
      recipientIds,
      FAN_OUT_CONCURRENCY,
      async (memberId) => {
        const initialTasks = await Promise.allSettled([
          emitRoomEvent(io, memberId, "group:message:new", decryptedMessage),
          incrGroupUnread(memberId, rawGroupId).catch((error) =>
            console.error(
              "[socketEmitter] incrGroupUnread failed:",
              errMsg(error),
            ),
          ),
        ]);

        for (const result of initialTasks) {
          if (result.status === "rejected") {
            console.error(
              "[socketEmitter] group recipient update failed:",
              errMsg(result.reason),
            );
          }
        }

        /*
         * Per-member backend trigger. This id was hit, so its conversation list
         * cache is dropped and re-synced. Runs after the increment above so the
         * refreshed counters already include this message.
         */
        const unread = await refreshUserId(io, memberId, {
          chatId: rawGroupId,
          isGroup: true,
          changedAt,
        });

        const notificationTasks: Promise<void>[] = [];

        if (meta) {
          notificationTasks.push(
            emitRoomEvent(io, memberId, "message:notify", {
              ...meta,
              ...(unread ? { unreadCounts: unread } : {}),
            }),
            emitRoomEvent(
              io,
              `admin-notifications:${memberId}`,
              "admin:message:notify",
              toAdminNotification(meta),
            ),
          );
        }

        const notificationResults = await Promise.allSettled(notificationTasks);
        for (const result of notificationResults) {
          if (result.status === "rejected") {
            console.error(
              "[socketEmitter] group notification delivery failed:",
              errMsg(result.reason),
            );
          }
        }

        // Reaches members whose app is minimised, backgrounded or closed; see
        // emitDirectMessageReceived.
        if (pushPayload) {
          void pushIfNotViewing(
            memberId,
            "group",
            pushPayload,
            () => isUserActivelyViewing(memberId),
          );
        }
      },
    );
  } catch (error: unknown) {
    console.error(
      "[socketEmitter] emitGroupMessageReceived error:",
      errMsg(error),
    );
  }
};

export const emitConversationRead = async (
  rawUserId: string,
  chat?: { kind: "direct" | "group"; chatId: string },
): Promise<void> => {
  if (!toObjectId(rawUserId)) {
    return;
  }

  try {
    const io = await getIo();

    if (chat) {
      await clearChatUnread(
        rawUserId,
        `${chat.kind === "direct" ? "c" : "g"}:${chat.chatId}`,
      );
    } else {
      await clearAllUnread(rawUserId);
    }

    const counts = await getUnreadCountsForUser(rawUserId);

    if (counts) {
      await emitRoomEvent(io, rawUserId, "unread:update", counts);
    }
  } catch (error: unknown) {
    console.error("[socketEmitter] emitConversationRead error:", errMsg(error));
  }
};
