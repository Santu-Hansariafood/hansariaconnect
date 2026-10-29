import { useCallback, useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { ChatMessage } from "@/components/pages/ChatWindow/ChatWindowTypes";
import type {
  ChatMessageMerger,
  ChatMessageSetter,
  SocketListener,
} from "./chatSocketTypes";

interface UseChatSocketMessagesOptions {
  id: string;
  isGroup: boolean;
  socket: Socket | null;
  addListener: SocketListener;
  removeListener: SocketListener;
  setChatMessages: ChatMessageSetter;
  mergeUnique: ChatMessageMerger;
  onIncomingMessage?: (msg: ChatMessage) => void;
}

interface MessageStatusAck {
  ok?: boolean;
  message?: {
    _id?: string | { toString?: () => string };
    id?: string;
    status?: ChatMessage["status"];
  };
}

interface UpdatedMessagePayload {
  peerId?: string;
  groupId?: string;
  message?: ChatMessage;
}

export const useChatSocketMessages = ({
  id,
  isGroup,
  socket,
  addListener,
  removeListener,
  setChatMessages,
  mergeUnique,
  onIncomingMessage,
}: UseChatSocketMessagesOptions) => {
  const updateMessageStatus = useCallback(
    (messageId: string, status: ChatMessage["status"]) => {
      setChatMessages((messages) =>
        messages.map((message) => {
          const currentId = String(
            message?._id?.toString?.() || message?.id || "",
          );
          return currentId === messageId ? { ...message, status } : message;
        }),
      );
    },
    [setChatMessages],
  );

  const markMessageReceived = useCallback(
    (messageId: string, groupId?: string) => {
      const payload = groupId
        ? { id: messageId, status: "delivered", groupId }
        : { id: messageId, status: "delivered" };
      socket?.emit("message:status", payload, (ack: MessageStatusAck) => {
        if (ack?.ok) {
          const ackId = String(
            ack?.message?._id?.toString?.() || ack?.message?.id || messageId,
          );
          updateMessageStatus(ackId, ack?.message?.status || "delivered");
        } else {
          console.warn(
            `[useChatSocket] Delivered-status ack not ok for msg ${messageId}:`,
            ack,
          );
        }
      });

      setTimeout(() => {
        socket?.emit(
          "message:status",
          { ...payload, status: "seen" },
          (ack: MessageStatusAck) => {
            if (ack?.ok) {
              const ackId = String(
                ack?.message?._id?.toString?.() || ack?.message?.id || messageId,
              );
              updateMessageStatus(ackId, ack?.message?.status || "seen");
            } else {
              console.warn(
                `[useChatSocket] Seen-status ack not ok for msg ${messageId}:`,
                ack,
              );
            }
          },
        );
      }, 500);
    },
    [socket, updateMessageStatus],
  );

  const handleNewDirectMessage = useCallback(
    (msg: ChatMessage) => {
      if (isGroup) return;

      const senderId = msg?.from?.toString?.() ?? String(msg?.from ?? "");
      const recipientId = msg?.to?.toString?.() ?? String(msg?.to ?? "");
      if (senderId !== id && recipientId !== id) return;

      const isFromPeer = senderId === id;
      onIncomingMessage?.(msg);
      setChatMessages((previous) => mergeUnique(previous, [msg]));

      if (!isFromPeer) return;
      const messageId = String(msg?._id?.toString?.() || msg?.id || "");
      if (!messageId) return;

      try {
        markMessageReceived(messageId);
        fetch("/api/read-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ peerId: id }),
        }).catch((error: unknown) =>
          console.error(
            "[useChatSocket] read-receipts POST (direct) failed:",
            error instanceof Error ? error.message : String(error),
          ),
        );
      } catch (error: unknown) {
        console.error(
          "[useChatSocket] Delivered/seen emit error (direct):",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [
      id,
      isGroup,
      markMessageReceived,
      mergeUnique,
      onIncomingMessage,
      setChatMessages,
    ],
  );

  const handleNewGroupMessage = useCallback(
    (msg: ChatMessage) => {
      if (!isGroup || String(msg?.groupId) !== id) return;

      const senderId = msg?.from?.toString?.() ?? String(msg?.from ?? "");
      onIncomingMessage?.(msg);
      setChatMessages((previous) => mergeUnique(previous, [msg]));

      if (senderId) {
        try {
          const messageId = String(msg?._id?.toString?.() || msg?.id || "");
          if (messageId) markMessageReceived(messageId, id);
        } catch (error: unknown) {
          console.error(
            "[useChatSocket] Group delivered/seen emit error:",
            error instanceof Error ? error.message : String(error),
          );
        }
      }

      fetch("/api/read-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ groupId: id }),
      }).catch((error: unknown) =>
        console.error(
          "[useChatSocket] read-receipts POST (group) failed:",
          error instanceof Error ? error.message : String(error),
        ),
      );
    },
    [
      id,
      isGroup,
      markMessageReceived,
      mergeUnique,
      onIncomingMessage,
      setChatMessages,
    ],
  );

  const updateMessage = useCallback(
    (payload: UpdatedMessagePayload, group: boolean) => {
      if (group !== isGroup) return;
      const conversationId = group ? payload?.groupId : payload?.peerId;
      if (String(conversationId || "") !== id) return;

      const updatedMessage = payload?.message;
      const updatedId = String(
        updatedMessage?._id?.toString?.() || updatedMessage?.id || "",
      );
      if (!updatedId) return;

      setChatMessages((messages) =>
        messages.map((message) => {
          const currentId = String(
            message?._id?.toString?.() || message?.id || "",
          );
          if (currentId !== updatedId) return message;
          return {
            ...message,
            ...updatedMessage,
            viewed:
              Boolean(updatedMessage?.viewedBy?.length) ||
              Boolean(updatedMessage?.viewed),
          };
        }),
      );
    },
    [id, isGroup, setChatMessages],
  );

  const handleDirectMessageUpdated = useCallback(
    (payload: UpdatedMessagePayload) => updateMessage(payload, false),
    [updateMessage],
  );
  const handleGroupMessageUpdated = useCallback(
    (payload: UpdatedMessagePayload) => updateMessage(payload, true),
    [updateMessage],
  );
  const handleStatusUpdate = useCallback(
    (data: { id?: string; status?: ChatMessage["status"] }) => {
      if (data?.id && data.status) {
        updateMessageStatus(String(data.id), data.status);
      }
    },
    [updateMessageStatus],
  );

  useEffect(() => {
    addListener("message:new", handleNewDirectMessage);
    addListener("group:message:new", handleNewGroupMessage);
    addListener("message:updated", handleDirectMessageUpdated);
    addListener("group:message:updated", handleGroupMessageUpdated);
    addListener("message:status:update", handleStatusUpdate);

    return () => {
      removeListener("message:new", handleNewDirectMessage);
      removeListener("group:message:new", handleNewGroupMessage);
      removeListener("message:updated", handleDirectMessageUpdated);
      removeListener("group:message:updated", handleGroupMessageUpdated);
      removeListener("message:status:update", handleStatusUpdate);
    };
  }, [
    addListener,
    handleDirectMessageUpdated,
    handleGroupMessageUpdated,
    handleNewDirectMessage,
    handleNewGroupMessage,
    handleStatusUpdate,
    removeListener,
  ]);
};
