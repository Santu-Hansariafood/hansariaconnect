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

import {
  invalidateDirectMessages,
  invalidateGroupMessages,
  invalidateUserConversations,
  redisDel,
} from "@/lib/redis/redis";
import { publishSocketRoomEvent } from "@/lib/socketRedisAdapter";

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
  _id: Types.ObjectId;
  name?: string;
  avatar?: string;
  members?: Array<{
    userId: Types.ObjectId | string;
  }>;
};

type ReadReceiptLean = {
  userId: Types.ObjectId;
  conversationId?: Types.ObjectId;
  groupId?: Types.ObjectId;
  readAt?: Date;
};

type SenderUserLean = {
  _id: Types.ObjectId;
  mobile?: string;
  name?: string;
};

type SenderProfileLean = {
  name?: string;
  photo?: string;
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
  createdAt?: Date;
  timestamp?: Date;
};

type UnreadPayload = {
  total: number;
  conversations: Record<string, number>;
  groups: Record<string, number>;
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
  timestamp: Date | string;
  unreadCounts: UnreadPayload;
};

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

const EMPTY_UNREAD: UnreadPayload = {
  total: 0,
  conversations: {},
  groups: {},
};

const DEFAULT_AVATAR = "/logo/logo.png";

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
          error instanceof Error ? error.message : "Unknown error",
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
      error instanceof Error ? error.message : String(error),
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
      error instanceof Error ? error.message : "Unknown error",
    );
  }

  io?.to(room).emit(event, payload);
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

const buildPreview = (
  message: Pick<DecryptedMessage, "type" | "text" | "fileName" | "linkTitle">,
): string => {
  switch (message.type) {
    case "image":
      return "📷 Photo";

    case "video":
      return "🎥 Video";

    case "audio":
      return "🎵 Voice message";

    case "file":
      return `📎 ${message.fileName || "File"}`;

    case "link":
      return `🔗 ${message.linkTitle || message.text || "Link"}`;

    case "text":
    default: {
      const text = message.text || "";

      return text.length > 120
        ? `${text.slice(0, 120)}…`
        : text || "New message";
    }
  }
};

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
  }> = [];

  const peerMap = new Map<string, string>();

  for (const conversation of conversations) {
    const peerId =
      String(conversation.userA) === String(userId)
        ? conversation.userB
        : conversation.userA;

    const lastReadAt = receiptMap.get(String(conversation._id)) ?? new Date(0);

    const peerIdString = String(peerId);

    peerMap.set(peerIdString, peerIdString);

    conditions.push({
      from: peerId,
      to: userId,
      createdAt: {
        $gt: lastReadAt,
      },
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  const results = await Message.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        $or: conditions,
      },
    },
    {
      $group: {
        _id: "$from",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const counts: Record<string, number> = {};

  for (const result of results) {
    const peerId = String(result._id);

    if (peerMap.has(peerId) && result.count > 0) {
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
      from: {
        $ne: userId,
      },
      createdAt: {
        $gt: lastReadAt,
      },
    });
  }

  if (conditions.length === 0) {
    return {};
  }

  const results = await GroupMessage.aggregate<{
    _id: Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        $or: conditions,
      },
    },
    {
      $group: {
        _id: "$groupId",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const counts: Record<string, number> = {};

  for (const result of results) {
    if (result.count > 0) {
      counts[String(result._id)] = result.count;
    }
  }

  return counts;
};

const computeUnreadForUser = async (
  rawUserId: string,
): Promise<UnreadPayload> => {
  const userId = toObjectId(rawUserId);

  if (!userId) {
    return EMPTY_UNREAD;
  }

  try {
    const [conversations, groups] = await Promise.all([
      computeDirectUnread(userId),
      computeGroupUnread(userId),
    ]);

    const total =
      Object.values(conversations).reduce((sum, count) => sum + count, 0) +
      Object.values(groups).reduce((sum, count) => sum + count, 0);

    return {
      total,
      conversations,
      groups,
    };
  } catch {
    return EMPTY_UNREAD;
  }
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

const buildDirectNotification = async (
  rawFromId: string,
  rawToId: string,
  decryptedMessage: DecryptedMessage,
  unreadCounts: UnreadPayload,
): Promise<IncomingNotificationPayload | null> => {
  const fromId = toObjectId(rawFromId);
  const toUserId = toObjectId(rawToId);

  if (!fromId || !toUserId) {
    return null;
  }

  try {
    const [senderUser, senderProfile, myContacts] = await Promise.all([
      User.findById(fromId)
        .select("_id mobile name")
        .lean() as Promise<SenderUserLean | null>,

      Profile.findOne({ userId: fromId })
        .select("name photo")
        .lean() as Promise<SenderProfileLean | null>,

      Contact.find({ userId: toUserId })
        .select("name mobiles")
        .lean() as Promise<ContactLean[]>,
    ]);

    const savedByName = findSavedContactName(myContacts, senderUser?.mobile);

    const senderName =
      savedByName ||
      senderProfile?.name ||
      senderUser?.name ||
      senderUser?.mobile ||
      "Unknown";

    const senderAvatar = senderProfile?.photo || DEFAULT_AVATAR;

    const preview = buildPreview(decryptedMessage);

    return {
      kind: "direct",
      chatId: rawFromId,
      messageId:
        decryptedMessage.id || String(decryptedMessage._id ?? "") || undefined,
      chatName: senderName,
      chatAvatar: senderAvatar,
      fromUserId: rawFromId,
      fromName: senderName,
      fromAvatar: senderAvatar,
      preview,
      messageType: decryptedMessage.type,
      timestamp: decryptedMessage.createdAt ?? new Date(),
      unreadCounts,
    };
  } catch {
    return null;
  }
};

const buildGroupNotification = async (
  rawGroupId: string,
  rawFromId: string,
  memberIds: string[],
  decryptedMessage: DecryptedMessage,
  unreadCountsByMember: Record<string, UnreadPayload>,
): Promise<Record<string, IncomingNotificationPayload>> => {
  const output: Record<string, IncomingNotificationPayload> = {};

  const groupId = toObjectId(rawGroupId);
  const fromId = toObjectId(rawFromId);

  if (!groupId || !fromId) {
    return output;
  }

  try {
    const [groupDoc, senderUser, senderProfile] = await Promise.all([
      Group.findById(groupId)
        .select("name avatar")
        .lean() as Promise<GroupLean | null>,

      User.findById(fromId)
        .select("_id mobile name")
        .lean() as Promise<SenderUserLean | null>,

      Profile.findOne({ userId: fromId })
        .select("name photo")
        .lean() as Promise<SenderProfileLean | null>,
    ]);

    const groupName = groupDoc?.name || "Group";
    const groupAvatar = groupDoc?.avatar || DEFAULT_AVATAR;

    const senderName =
      senderProfile?.name ||
      senderUser?.name ||
      senderUser?.mobile ||
      "Unknown";

    const senderAvatar = senderProfile?.photo || DEFAULT_AVATAR;

    const preview = buildPreview(decryptedMessage);

    for (const memberId of memberIds) {
      if (!memberId || memberId === rawFromId) {
        continue;
      }

      const counts = unreadCountsByMember[memberId] ?? EMPTY_UNREAD;

      output[memberId] = {
        kind: "group",
        chatId: rawGroupId,
        messageId:
          decryptedMessage.id || String(decryptedMessage._id ?? "") || undefined,
        chatName: groupName,
        chatAvatar: groupAvatar,
        fromUserId: rawFromId,
        fromName: senderName,
        fromAvatar: senderAvatar,
        preview:
          groupName !== senderName ? `${senderName}: ${preview}` : preview,
        messageType: decryptedMessage.type,
        timestamp: decryptedMessage.createdAt ?? new Date(),
        unreadCounts: counts,
      };
    }

    return output;
  } catch {
    return output;
  }
};

export const emitDirectMessageReceived = async (
  rawFromId: string,
  rawToId: string,
  decryptedMessage: DecryptedMessage,
): Promise<void> => {
  const io = await getIo();

  const fromId = toObjectId(rawFromId);
  const toId = toObjectId(rawToId);

  if (!fromId || !toId) {
    return;
  }

  try {
    await Promise.all([
      invalidateDirectMessages(rawFromId, rawToId),
      invalidateUserConversations(rawFromId),
      invalidateUserConversations(rawToId),
      redisDel(`unread:${rawToId}`),
      redisDel(`unread:${rawFromId}`),
    ]);

    const recipientCounts = await computeUnreadForUser(rawToId);

    await emitRoomEvent(io, rawToId, "message:new", decryptedMessage);
    await emitRoomEvent(io, rawToId, "unread:update", recipientCounts);

    const notification = await buildDirectNotification(
      rawFromId,
      rawToId,
      decryptedMessage,
      recipientCounts,
    );

    if (notification) {
      console.log("[socketEmitter] Emitting message:notify to", rawToId, { kind: notification.kind, from: notification.fromUserId });
      await emitRoomEvent(io, rawToId, "message:notify", notification);
      const adminNotification: AdminNotificationPayload = {
        kind: notification.kind,
        chatId: notification.chatId,
        chatName: notification.chatName,
        chatAvatar: notification.chatAvatar,
        fromUserId: notification.fromUserId,
        fromName: notification.fromName,
        fromAvatar: notification.fromAvatar,
        timestamp: notification.timestamp,
      };
      await emitRoomEvent(
        io,
        `admin-notifications:${rawToId}`,
        "admin:message:notify",
        adminNotification,
      );
    } else {
      console.warn("[socketEmitter] buildDirectNotification returned null - skipping notification emit");
    }
  } catch (error: unknown) {
    console.error(
      "[socketEmitter] emitDirectMessageReceived error:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
};

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
  const io = await getIo();

  const groupId = toObjectId(rawGroupId);
  const fromId = toObjectId(rawFromId);

  if (!groupId || !fromId) {
    return;
  }

  try {
    await invalidateGroupMessages(rawGroupId);

    const memberIds = Array.from(
      new Set(
        members
          .map((member) => {
            if (typeof member === "string") {
              return member;
            }

            return String(member?.userId ?? "");
          })
          .filter(
            (memberId): memberId is string =>
              Boolean(memberId) && Types.ObjectId.isValid(memberId),
          ),
      ),
    );

    const recipientIds = memberIds.filter((memberId) => memberId !== rawFromId);

    if (recipientIds.length === 0) {
      return;
    }

    await Promise.all(
      recipientIds.map((memberId) => invalidateUserConversations(memberId)),
    );

    const unreadResults = await Promise.all(
      recipientIds.map(async (memberId) => {
        const counts = await computeUnreadForUser(memberId);

        return {
          memberId,
          counts,
        };
      }),
    );

    const unreadCountsByMember: Record<string, UnreadPayload> = {};

    for (const result of unreadResults) {
      unreadCountsByMember[result.memberId] = result.counts;
    }

    await Promise.all(
      recipientIds.map(async (memberId) => {
        await redisDel(`unread:${memberId}`);

        await emitRoomEvent(
          io,
          memberId,
          "unread:update",
          unreadCountsByMember[memberId],
        );
      }),
    );

    const notifications = await buildGroupNotification(
      rawGroupId,
      rawFromId,
      memberIds,
      decryptedMessage,
      unreadCountsByMember,
    );

    const memberNotifCount = Object.keys(notifications).length;
    if (memberNotifCount > 0) {
      console.log("[socketEmitter] Emitting group message:notify to", memberNotifCount, "members for group", rawGroupId);
    } else {
      console.warn("[socketEmitter] buildGroupNotification returned empty map - skipping group", rawGroupId);
    }
    await Promise.all(
      Object.entries(notifications).map(
        async ([memberId, notification]) => {
          console.log("[socketEmitter]   → notify", memberId, { from: notification.fromUserId });
          await emitRoomEvent(io, memberId, "group:message:new", decryptedMessage);
          await emitRoomEvent(io, memberId, "message:notify", notification);
          const adminNotification: AdminNotificationPayload = {
            kind: notification.kind,
            chatId: notification.chatId,
            chatName: notification.chatName,
            chatAvatar: notification.chatAvatar,
            fromUserId: notification.fromUserId,
            fromName: notification.fromName,
            fromAvatar: notification.fromAvatar,
            timestamp: notification.timestamp,
          };
          await emitRoomEvent(
            io,
            `admin-notifications:${memberId}`,
            "admin:message:notify",
            adminNotification,
          );
        },
      ),
    );
  } catch (error: unknown) {
    console.error(
      "[socketEmitter] emitGroupMessageReceived error:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
};

export const emitConversationRead = async (
  rawUserId: string,
): Promise<void> => {
  const io = await getIo();

  const userId = toObjectId(rawUserId);

  if (!userId) {
    return;
  }

  try {
    await redisDel(`unread:${rawUserId}`);

    const counts = await computeUnreadForUser(rawUserId);

    await emitRoomEvent(io, rawUserId, "unread:update", counts);
  } catch (error: unknown) {
    console.error(
      "[socketEmitter] emitConversationRead error:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
};
