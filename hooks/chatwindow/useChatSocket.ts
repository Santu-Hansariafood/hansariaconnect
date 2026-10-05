import { useEffect, useCallback, useRef, useState } from "react";
import { useSocket } from "../useSocket";

export const useChatSocket = (
  id: string,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  mergeUnique: (prev: any[], incoming: any[]) => any[],
  onIncomingMessage?: (msg: any) => void,
  isGroup: boolean = false,
) => {
  const { socket, addListener, removeListener } = useSocket();
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const typingTimeoutsRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const typingSendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const TYPING_TIMEOUT_MS = 3500;
  const TYPING_SEND_THROTTLE_MS = 1500;

  const handleNewDirectMessage = useCallback(
    (msg: any) => {
      if (isGroup) return;

      const senderId = msg?.from?.toString?.() ?? String(msg?.from ?? "");
      const recipientId = msg?.to?.toString?.() ?? String(msg?.to ?? "");
      const matchesChat = senderId === id || recipientId === id;

      if (!matchesChat) return;

      onIncomingMessage?.(msg);
      setChatMessages((prev) => mergeUnique(prev, [msg]));

      try {
        socket?.emit(
          "message:status",
          { id: msg?._id?.toString?.(), status: "delivered" },
          (ack: any) => {
            if (ack?.ok && ack?.message?._id) {
              const mid = ack.message._id?.toString?.();
              if (mid) {
                setChatMessages((prev) =>
                  prev.map((m: any) => {
                    const idStr = m?._id?.toString?.();
                    if (idStr && idStr === mid)
                      return { ...m, status: ack.message.status };
                    return m;
                  }),
                );
              }
            }
          },
        );

        setTimeout(() => {
          socket?.emit(
            "message:status",
            { id: msg?._id?.toString?.(), status: "seen" },
            (ack: any) => {
              if (ack?.ok && ack?.message?._id) {
                const mid = ack.message._id?.toString?.();
                if (mid) {
                  setChatMessages((prev) =>
                    prev.map((m: any) => {
                      const idStr = m?._id?.toString?.();
                      if (idStr && idStr === mid)
                        return { ...m, status: ack.message.status };
                      return m;
                    }),
                  );
                }
              }
            },
          );
        }, 500);

        fetch("/api/read-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ peerId: id }),
        }).catch(() => {});
      } catch {}
    },
    [id, setChatMessages, mergeUnique, socket, isGroup, onIncomingMessage],
  );

  const handleNewGroupMessage = useCallback(
    (msg: any) => {
      if (!isGroup) return;
      if (String(msg?.groupId) === id) {
        onIncomingMessage?.(msg);
        setChatMessages((prev) => mergeUnique(prev, [msg]));
        try {
          fetch("/api/read-receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ groupId: id }),
          });
        } catch {}
      }
    },
    [id, setChatMessages, mergeUnique, isGroup, onIncomingMessage],
  );

  const handleStatusUpdate = useCallback(
    (data: any) => {
      if (data?.id) {
        setChatMessages((prev) =>
          prev.map((m: any) => {
            const idStr = m?._id?.toString?.();
            if (idStr && idStr === data.id)
              return { ...m, status: data.status };
            return m;
          }),
        );
      }
    },
    [setChatMessages],
  );

  const addTypingUser = useCallback((fromId: string) => {
    if (!fromId) return;
    setTypingUserIds((prev) => (prev.includes(fromId) ? prev : [...prev, fromId]));
    const existing = typingTimeoutsRef.current.get(fromId);
    if (existing) clearTimeout(existing);
    const timeout = setTimeout(() => {
      setTypingUserIds((prev) => prev.filter((uid) => uid !== fromId));
      typingTimeoutsRef.current.delete(fromId);
    }, TYPING_TIMEOUT_MS);
    typingTimeoutsRef.current.set(fromId, timeout);
  }, [TYPING_TIMEOUT_MS]);

  const removeTypingUser = useCallback((fromId: string) => {
    if (!fromId) return;
    const existing = typingTimeoutsRef.current.get(fromId);
    if (existing) clearTimeout(existing);
    typingTimeoutsRef.current.delete(fromId);
    setTypingUserIds((prev) => prev.filter((uid) => uid !== fromId));
  }, []);

  const handleTypingStart = useCallback(
    (data: { from?: string; peerId?: string; groupId?: string }) => {
      const fromId = String(data?.from || "");
      if (!fromId) return;
      if (isGroup) {
        if (String(data?.groupId || "") === id) addTypingUser(fromId);
      } else {
        const peerId = String(data?.peerId || "");
        if (peerId === id || fromId === id) addTypingUser(fromId);
      }
    },
    [id, isGroup, addTypingUser],
  );

  const handleTypingStop = useCallback(
    (data: { from?: string; peerId?: string; groupId?: string }) => {
      const fromId = String(data?.from || "");
      if (!fromId) return;
      if (isGroup) {
        if (String(data?.groupId || "") === id) removeTypingUser(fromId);
      } else {
        const peerId = String(data?.peerId || "");
        if (peerId === id || fromId === id) removeTypingUser(fromId);
      }
    },
    [id, isGroup, removeTypingUser],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!socket || !id) return;
      const now = Date.now();

      if (isTyping) {
        if (now - lastTypingSentRef.current < TYPING_SEND_THROTTLE_MS) return;
        lastTypingSentRef.current = now;
        try {
          socket.emit("typing:start", isGroup ? { groupId: id } : { peerId: id });
        } catch {}
        if (typingSendDebounceRef.current) clearTimeout(typingSendDebounceRef.current);
        typingSendDebounceRef.current = setTimeout(() => {
          try {
            socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
          } catch {}
        }, TYPING_TIMEOUT_MS);
      } else {
        if (typingSendDebounceRef.current) {
          clearTimeout(typingSendDebounceRef.current);
          typingSendDebounceRef.current = null;
        }
        try {
          socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
        } catch {}
      }
    },
    [socket, id, isGroup, TYPING_SEND_THROTTLE_MS, TYPING_TIMEOUT_MS],
  );

  useEffect(() => {
    // When a new message arrives from a typing user, clear their typing indicator
    const clearTypingForSender = (fromVal: any) => {
      const fromId = String(fromVal || "");
      if (fromId) removeTypingUser(fromId);
    };

    const origHandleNew = handleNewDirectMessage;
    const origHandleGroupNew = handleNewGroupMessage;
    // We'll patch the clear into the existing handlers via separate listeners below
    const clearDirectTyping = (msg: any) => clearTypingForSender(msg?.from);
    const clearGroupTyping = (msg: any) => {
      if (String(msg?.groupId || "") === id) clearTypingForSender(msg?.from);
    };

    addListener("message:new", clearDirectTyping);
    addListener("group:message:new", clearGroupTyping);

    return () => {
      removeListener("message:new", clearDirectTyping);
      removeListener("group:message:new", clearGroupTyping);
    };
  }, [addListener, removeListener, handleNewDirectMessage, handleNewGroupMessage, id, removeTypingUser]);

  useEffect(() => {
    addListener("message:new", handleNewDirectMessage);
    addListener("group:message:new", handleNewGroupMessage);
    addListener("message:status:update", handleStatusUpdate);
    addListener("typing:start", handleTypingStart);
    addListener("typing:stop", handleTypingStop);

    return () => {
      removeListener("message:new", handleNewDirectMessage);
      removeListener("group:message:new", handleNewGroupMessage);
      removeListener("message:status:update", handleStatusUpdate);
      removeListener("typing:start", handleTypingStart);
      removeListener("typing:stop", handleTypingStop);
    };
  }, [
    addListener,
    removeListener,
    handleNewDirectMessage,
    handleNewGroupMessage,
    handleStatusUpdate,
    handleTypingStart,
    handleTypingStop,
  ]);

  useEffect(() => {
    return () => {
      typingTimeoutsRef.current.forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current.clear();
      if (typingSendDebounceRef.current) clearTimeout(typingSendDebounceRef.current);
      setTypingUserIds([]);
    };
  }, []);

  useEffect(() => {
    if (!id) return;

    const fetchLatest = async (force = false) => {
      if (!force && socket?.connected) return;
      if (document.visibilityState !== "visible") return;
      try {
        const endpoint = isGroup
          ? `/api/groups/${id}/messages?limit=30&last=true`
          : `/api/messages/${id}?limit=30&last=true`;
        const res = await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setChatMessages((prev) => mergeUnique(prev, data.messages));
        }
      } catch (error) {
        console.warn("[useChatSocket] Fallback message refresh failed:", error);
      }
    };

    const handleConnect = () => {
      void fetchLatest(true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetchLatest(true);
    };

    socket?.on("connect", handleConnect);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const interval = setInterval(() => void fetchLatest(), 15000);
    void fetchLatest(true);

    return () => {
      clearInterval(interval);
      socket?.off("connect", handleConnect);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [id, isGroup, mergeUnique, setChatMessages, socket]);

  return { socket, typingUserIds, sendTyping };
};
