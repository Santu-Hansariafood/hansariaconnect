"use client";

import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { Socket } from "socket.io-client";

import { invalidateApiCache } from "@/lib/api/clientCache";
import { resolveChatId } from "@/lib/chatIdentity";
import type { Contact } from "./useContacts";

type RealtimeMessage = {
  _id?: string;
  id?: string;
  from?: string;
  to?: string;
  groupId?: string;
  type?: string;
  text?: string;
  linkTitle?: string;
  createdAt?: string;
  timestamp?: string;
};

type UnreadPayload = {
  conversations?: Record<string, number>;
  groups?: Record<string, number>;
};

type SocketListener = (type: string, handler: (...args: never[]) => void) => void;

/** WhatsApp-style one-line preview for the chat list. */
export const getMessagePreview = (message?: RealtimeMessage): string => {
  switch (message?.type) {
    case "image":
      return "📷 Image";
    case "video":
      return "🎥 Video";
    case "voice":
      return "🎤 Voice";
    case "pdf":
      return "📄 PDF";
    case "excel":
      return "📊 Excel";
    case "link":
      return message?.linkTitle || "🔗 Link";
    default:
      return message?.text || "New message";
  }
};

const peerKey = (contact: Contact) => resolveChatId(contact);

interface UseChatListRealtimeOptions {
  userId?: string | number;
  selectedChatId?: string;
  socket: Socket | null;
  setContacts: Dispatch<SetStateAction<Contact[]>>;
  refreshContacts: () => void | Promise<void>;
  addListener: SocketListener;
  removeListener: SocketListener;
}

/**
 * Keeps the chat list in sync over the socket: bumps the preview/unread badge for
 * direct and group messages, applies unread counters, and falls back to a
 * conversation refresh when a message belongs to a peer outside the local list.
 */
export const useChatListRealtime = ({
  userId,
  selectedChatId,
  socket,
  setContacts,
  refreshContacts,
  addListener,
  removeListener,
}: UseChatListRealtimeOptions) => {
  // Refs keep the listeners stable so they are not torn down on every prop change.
  const selectedChatIdRef = useRef(selectedChatId);
  const userIdRef = useRef(String(userId || ""));
  const socketRef = useRef(socket);

  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  useEffect(() => {
    userIdRef.current = String(userId || "");
  }, [userId]);

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const handleIncomingMessage = (message: RealtimeMessage) => {
      const fromId = String(message?.from || "");
      const toId = String(message?.to || "");
      const myId = userIdRef.current;

      if (!fromId || !toId) return;

      const isFromMe = fromId === myId;
      const peerId = isFromMe ? toId : fromId;

      if (!peerId || peerId === myId) return;

      const recipientId = toId;
      const messageId = String(message?._id || message?.id || "");
      if (!isFromMe && recipientId === myId && /^[0-9a-f]{24}$/i.test(messageId)) {
        socketRef.current?.emit(
          "message:status",
          { id: messageId, status: "delivered" },
          (ack: { ok?: boolean; error?: string }) => {
            if (!ack?.ok) {
              console.warn(
                "[ChatHome] Could not confirm message delivery:",
                ack?.error || "Unknown status error",
              );
            }
          },
        );
      }

      let foundPeer = false;
      setContacts((previous) =>
        previous.map((contact) => {
          if (peerKey(contact) !== peerId) return contact;
          foundPeer = true;

          return {
            ...contact,
            lastMessage: getMessagePreview(message),
            lastMessageTime:
              message?.createdAt || message?.timestamp || new Date().toISOString(),
            lastMessageFromMe: isFromMe,
            unread:
              isFromMe || selectedChatIdRef.current === peerId
                ? 0
                : Number(contact.unread || 0) + 1,
          };
        }),
      );

      // A peer outside the local list means the cached conversation list is
      // behind — refresh with fresh data instead of a possibly stale copy.
      if (!foundPeer) {
        invalidateApiCache("/api/conversations");
        void refreshContacts();
      }
    };

    const handleIncomingGroupMessage = (message: RealtimeMessage) => {
      const groupId = String(message?.groupId || "");
      if (!groupId) return;

      const isFromMe = String(message?.from || "") === userIdRef.current;

      let foundGroup = false;
      setContacts((previous) =>
        previous.map((contact) => {
          if (peerKey(contact) !== groupId || !contact.isGroup) return contact;
          foundGroup = true;
          return {
            ...contact,
            lastMessage: getMessagePreview(message),
            lastMessageTime:
              message?.createdAt || message?.timestamp || new Date().toISOString(),
            lastMessageFromMe: isFromMe,
            unread:
              isFromMe || selectedChatIdRef.current === groupId
                ? 0
                : Number(contact.unread || 0) + 1,
          };
        }),
      );

      if (!foundGroup) {
        invalidateApiCache("/api/conversations");
        void refreshContacts();
      }
    };

    const handleUnreadUpdate = (payload: UnreadPayload) => {
      if (!payload || typeof payload !== "object") return;

      invalidateApiCache("/api/unread-counts");

      const mergedUnread: Record<string, number> = {
        ...(payload.conversations || {}),
        ...(payload.groups || {}),
      };

      setContacts((previous) =>
        previous.map((contact) => {
          const unread = Number(mergedUnread[peerKey(contact)] || 0);
          return contact.unread === unread ? contact : { ...contact, unread };
        }),
      );
    };

    addListener("message:new", handleIncomingMessage);
    addListener("group:message:new", handleIncomingGroupMessage);
    addListener("unread:update", handleUnreadUpdate);

    return () => {
      removeListener("message:new", handleIncomingMessage);
      removeListener("group:message:new", handleIncomingGroupMessage);
      removeListener("unread:update", handleUnreadUpdate);
    };
  }, [addListener, refreshContacts, removeListener, setContacts]);
};
