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
  type: string;
  text?: string;
  fileName?: string;
  linkTitle?: string;
  createdAt?: Date;
};

type UnreadPayload = {
  total: number;
  conversations: Record<string, number>;
  groups: Record<string, number>;
};

type IncomingNotificationPayload = {
  kind: "direct" | "group";
  chatId: string;
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

const EMPTY_UNREAD: UnreadPayload = {
  total: 0,
  conversations: {},
  groups: {},
};

const DEFAULT_AVATAR = "/logo/logo.png";

const getIo = (): ServerIO | null => {
  try {
    const io = (globalThis as any).__io as ServerIO | undefined;
    return io ?? null;
  } catch {
    return null;
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
  const io = getIo();

  if (!io) {
    return;
  }

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

    io.to(rawToId).emit("unread:update", recipientCounts);

    const notification = await buildDirectNotification(
      rawFromId,
      rawToId,
      decryptedMessage,
      recipientCounts,
    );

    if (notification) {
      io.to(rawToId).emit("message:notify", notification);
    }
  } catch {
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
  const io = getIo();

  if (!io) {
    return;
  }

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

        io.to(memberId).emit("unread:update", unreadCountsByMember[memberId]);
      }),
    );

    const notifications = await buildGroupNotification(
      rawGroupId,
      rawFromId,
      memberIds,
      decryptedMessage,
      unreadCountsByMember,
    );

    for (const [memberId, notification] of Object.entries(notifications)) {
      io.to(memberId).emit("message:notify", notification);
    }
  } catch {
    return;
  }
};

export const emitConversationRead = async (
  rawUserId: string,
): Promise<void> => {
  const io = getIo();

  if (!io) {
    return;
  }

  const userId = toObjectId(rawUserId);

  if (!userId) {
    return;
  }

  try {
    await redisDel(`unread:${rawUserId}`);

    const counts = await computeUnreadForUser(rawUserId);

    io.to(rawUserId).emit("unread:update", counts);
  } catch {
    return;
  }
};
