import { useCallback, useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import type { ChatMessage } from "@/components/pages/ChatWindow/ChatWindowTypes";
import type { SocketListener } from "./chatSocketTypes";

interface UseChatSocketTypingOptions {
  id: string;
  isGroup: boolean;
  socket: Socket | null;
  addListener: SocketListener;
  removeListener: SocketListener;
}

const TYPING_TIMEOUT_MS = 3500;
const TYPING_SEND_THROTTLE_MS = 1500;

export const useChatSocketTyping = ({
  id,
  isGroup,
  socket,
  addListener,
  removeListener,
}: UseChatSocketTypingOptions) => {
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const typingTimeoutsRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const typingSendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastTypingSentRef = useRef(0);
  const isTypingSentRef = useRef(false);

  const addTypingUser = useCallback((fromId: string) => {
    if (!fromId) return;
    setTypingUserIds((previous) =>
      previous.includes(fromId) ? previous : [...previous, fromId],
    );
    const existing = typingTimeoutsRef.current.get(fromId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      setTypingUserIds((previous) => previous.filter((id) => id !== fromId));
      typingTimeoutsRef.current.delete(fromId);
    }, TYPING_TIMEOUT_MS);
    typingTimeoutsRef.current.set(fromId, timeout);
  }, []);

  const removeTypingUser = useCallback((fromId: string) => {
    if (!fromId) return;
    const existing = typingTimeoutsRef.current.get(fromId);
    if (existing) clearTimeout(existing);
    typingTimeoutsRef.current.delete(fromId);
    setTypingUserIds((previous) => previous.filter((id) => id !== fromId));
  }, []);

  const handleTypingStart = useCallback(
    (data: { from?: string; peerId?: string; groupId?: string }) => {
      const fromId = String(data?.from || "");
      if (!fromId) return;
      if (isGroup) {
        if (String(data?.groupId || "") === id) addTypingUser(fromId);
      } else if (String(data?.peerId || "") === id || fromId === id) {
        addTypingUser(fromId);
      }
    },
    [addTypingUser, id, isGroup],
  );

  const handleTypingStop = useCallback(
    (data: { from?: string; peerId?: string; groupId?: string }) => {
      const fromId = String(data?.from || "");
      if (!fromId) return;
      if (isGroup) {
        if (String(data?.groupId || "") === id) removeTypingUser(fromId);
      } else if (String(data?.peerId || "") === id || fromId === id) {
        removeTypingUser(fromId);
      }
    },
    [id, isGroup, removeTypingUser],
  );

  const clearDirectTyping = useCallback(
    (message: ChatMessage) => removeTypingUser(String(message?.from || "")),
    [removeTypingUser],
  );
  const clearGroupTyping = useCallback(
    (message: ChatMessage) => {
      if (String(message?.groupId || "") === id) {
        removeTypingUser(String(message?.from || ""));
      }
    },
    [id, removeTypingUser],
  );

  useEffect(() => {
    addListener("typing:start", handleTypingStart);
    addListener("typing:stop", handleTypingStop);
    addListener("message:new", clearDirectTyping);
    addListener("group:message:new", clearGroupTyping);
    return () => {
      removeListener("typing:start", handleTypingStart);
      removeListener("typing:stop", handleTypingStop);
      removeListener("message:new", clearDirectTyping);
      removeListener("group:message:new", clearGroupTyping);
    };
  }, [
    addListener,
    clearDirectTyping,
    clearGroupTyping,
    handleTypingStart,
    handleTypingStop,
    removeListener,
  ]);

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !id) return;
      const payload = isGroup ? { groupId: id } : { peerId: id };
      const emitStop = (source: string) => {
        try {
          socket.emit("typing:stop", payload);
        } catch (error: unknown) {
          console.warn(
            `[useChatSocket] typing:stop emit error (${source}):`,
            error instanceof Error ? error.message : String(error),
          );
        }
      };

      if (isTyping) {
        const now = Date.now();
        if (now - lastTypingSentRef.current >= TYPING_SEND_THROTTLE_MS) {
          lastTypingSentRef.current = now;
          isTypingSentRef.current = true;
          try {
            socket.emit("typing:start", payload);
          } catch (error: unknown) {
            console.warn(
              "[useChatSocket] typing:start emit error:",
              error instanceof Error ? error.message : String(error),
            );
          }
        }
        if (typingSendDebounceRef.current) {
          clearTimeout(typingSendDebounceRef.current);
        }
        typingSendDebounceRef.current = setTimeout(() => {
          typingSendDebounceRef.current = null;
          if (!isTypingSentRef.current) return;
          isTypingSentRef.current = false;
          emitStop("timeout");
        }, TYPING_TIMEOUT_MS);
        return;
      }

      if (typingSendDebounceRef.current) {
        clearTimeout(typingSendDebounceRef.current);
        typingSendDebounceRef.current = null;
      }
      if (!isTypingSentRef.current) return;
      isTypingSentRef.current = false;
      emitStop("manual");
    },
    [id, isGroup, socket],
  );

  useEffect(
    () => () => {
      typingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
      if (typingSendDebounceRef.current) {
        clearTimeout(typingSendDebounceRef.current);
        typingSendDebounceRef.current = null;
      }
      if (isTypingSentRef.current && socket) {
        socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
        isTypingSentRef.current = false;
      }
    },
    [id, isGroup, socket],
  );

  return { typingUserIds, sendTyping };
};
