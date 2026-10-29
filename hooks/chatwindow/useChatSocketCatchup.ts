import { useEffect } from "react";
import type { Socket } from "socket.io-client";
import type { ChatMessage } from "@/components/pages/ChatWindow/ChatWindowTypes";
import type {
  ChatMessageMerger,
  ChatMessageSetter,
} from "./chatSocketTypes";

interface UseChatSocketCatchupOptions {
  id: string;
  isGroup: boolean;
  socket: Socket | null;
  setChatMessages: ChatMessageSetter;
  mergeUnique: ChatMessageMerger;
  skipInitialCatchup: boolean;
}

export const useChatSocketCatchup = ({
  id,
  isGroup,
  socket,
  setChatMessages,
  mergeUnique,
  skipInitialCatchup,
}: UseChatSocketCatchupOptions) => {
  useEffect(() => {
    if (!id) return;

    let lastCatchupAt = 0;
    const CATCHUP_COOLDOWN_MS = 10_000;

    const fetchLatest = async (force = false) => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      const now = Date.now();
      if (!force && now - lastCatchupAt < CATCHUP_COOLDOWN_MS) return;
      lastCatchupAt = now;

      try {
        const endpoint = isGroup
          ? `/api/groups/${id}/messages?limit=30&last=true`
          : `/api/messages/${id}?limit=30&last=true`;
        const response = await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) {
          console.warn(
            "[useChatSocket] Catchup fetch HTTP",
            response.status,
            "for chat",
            id,
          );
          return;
        }
        const data: unknown = await response.json();
        if (
          isMessagePage(data) &&
          data.messages.length > 0
        ) {
          setChatMessages((previous) =>
            mergeUnique(previous, data.messages),
          );
        }
      } catch (error: unknown) {
        console.warn(
          "[useChatSocket] Catchup message refresh failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
    };

    const handleConnect = () => void fetchLatest(true);
    const handleReconnect = () => void fetchLatest(true);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchLatest(true);
    };

    socket?.on("connect", handleConnect);
    socket?.io?.on("reconnect", handleReconnect);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    if (!skipInitialCatchup) void fetchLatest(true);

    return () => {
      socket?.off("connect", handleConnect);
      socket?.io?.off("reconnect", handleReconnect);
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [
    id,
    isGroup,
    mergeUnique,
    setChatMessages,
    socket,
    skipInitialCatchup,
  ]);
};

const isMessagePage = (
  value: unknown,
): value is { messages: ChatMessage[] } =>
  typeof value === "object" &&
  value !== null &&
  "messages" in value &&
  Array.isArray(value.messages);
