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
  const isTypingSentRef = useRef(false);
  const TYPING_TIMEOUT_MS = 3500;
  const TYPING_SEND_THROTTLE_MS = 1500;

  const handleNewDirectMessage = useCallback(
    (msg: any) => {
      if (isGroup) return;

      const senderId = msg?.from?.toString?.() ?? String(msg?.from ?? "");
      const recipientId = msg?.to?.toString?.() ?? String(msg?.to ?? "");
      const matchesChat = senderId === id || recipientId === id;

      if (!matchesChat) return;

      const isFromPeer = senderId === id;

      console.log(
        "[useChatSocket] Direct message received via socket",
        "| from:",
        senderId,
        "| to:",
        recipientId,
        "| isFromPeer:",
        isFromPeer,
        "| chatId (peer):",
        id,
      );

      onIncomingMessage?.(msg);
      setChatMessages((prev) => mergeUnique(prev, [msg]));

      if (!isFromPeer) return;
      const messageId = String(msg?._id?.toString?.() || msg?.id || "");
      if (!messageId) return;

      try {
        socket?.emit(
          "message:status",
          { id: messageId, status: "delivered" },
          (ack: any) => {
            if (ack?.ok) {
              setChatMessages((prev) =>
                prev.map((m: any) => {
                  const idStr = String(m?._id?.toString?.() || m?.id || "");
                  if (idStr === messageId)
                    return { ...m, status: ack.message.status };
                  return m;
                }),
              );
            } else {
              console.warn(
                "[useChatSocket] Delivered-status ack not ok for msg",
                msg?._id,
                ":",
                ack,
              );
            }
          },
        );

        setTimeout(() => {
          socket?.emit(
            "message:status",
            { id: messageId, status: "seen" },
            (ack: any) => {
              if (ack?.ok) {
                  setChatMessages((prev) =>
                    prev.map((m: any) => {
                      const idStr = String(m?._id?.toString?.() || m?.id || "");
                      if (idStr === messageId)
                        return { ...m, status: ack.message.status };
                      return m;
                    }),
                  );
              } else {
                console.warn(
                  "[useChatSocket] Seen-status ack not ok for msg",
                  msg?._id,
                  ":",
                  ack,
                );
              }
            },
          );
        }, 500);

        fetch("/api/read-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ peerId: id }),
        }).catch((err: any) =>
          console.error(
            "[useChatSocket] read-receipts POST (direct) failed:",
            err?.message || err,
          ),
        );
      } catch (err: any) {
        console.error(
          "[useChatSocket] Delivered/seen emit error (direct):",
          err?.message || err,
        );
      }
    },
    [id, setChatMessages, mergeUnique, socket, isGroup, onIncomingMessage],
  );

  const handleNewGroupMessage = useCallback(
    (msg: any) => {
      if (!isGroup) return;
      if (String(msg?.groupId) !== id) return;

      const senderId = msg?.from?.toString?.() ?? String(msg?.from ?? "");
      const isFromOtherMember = Boolean(senderId);

      console.log(
        "[useChatSocket] Group message received via socket",
        "| groupId:",
        msg?.groupId,
        "| from:",
        senderId,
        "| chatId:",
        id,
      );

      onIncomingMessage?.(msg);
      setChatMessages((prev) => mergeUnique(prev, [msg]));

      if (isFromOtherMember) {
        try {
          socket?.emit(
            "message:status",
            { id: msg?._id?.toString?.() || msg?.id, status: "delivered", groupId: id },
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
              } else {
                console.warn(
                  "[useChatSocket] Group delivered-status ack not ok for msg",
                  msg?._id,
                  ":",
                  ack,
                );
              }
            },
          );

          setTimeout(() => {
            socket?.emit(
              "message:status",
              { id: msg?._id?.toString?.() || msg?.id, status: "seen", groupId: id },
              (ack: any) => {
                if (ack?.ok && ack?.message?._id) {
                  const mid = ack.message._id?.toString?.();
                  if (mid) {
                    setChatMessages((prev) =>
                      prev.map((m: any) => {
                        const idStr = String(m?._id?.toString?.() || m?.id || "");
                        if (idStr && idStr === mid)
                          return { ...m, status: ack.message.status };
                        return m;
                      }),
                    );
                  }
                } else {
                  console.warn(
                    "[useChatSocket] Group seen-status ack not ok for msg",
                    msg?._id,
                    ":",
                    ack,
                  );
                }
              },
            );
          }, 500);
        } catch (err: any) {
          console.error(
            "[useChatSocket] Group delivered/seen emit error:",
            err?.message || err,
          );
        }
      }

      try {
        fetch("/api/read-receipts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ groupId: id }),
        }).catch((err: any) =>
          console.error(
            "[useChatSocket] read-receipts POST (group) failed:",
            err?.message || err,
          ),
        );
      } catch (err: any) {
        console.error(
          "[useChatSocket] read-receipts wrapper error (group):",
          err?.message || err,
        );
      }
    },
    [id, setChatMessages, mergeUnique, isGroup, onIncomingMessage, socket],
  );

  const handleStatusUpdate = useCallback(
    (data: any) => {
      if (data?.id) {
        setChatMessages((prev) =>
          prev.map((m: any) => {
            const idStr = String(m?._id?.toString?.() || m?.id || "");
            if (idStr === String(data.id))
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

      if (isTyping) {
        const now = Date.now();
        if (now - lastTypingSentRef.current >= TYPING_SEND_THROTTLE_MS) {
          lastTypingSentRef.current = now;
          isTypingSentRef.current = true;
          try {
            socket.emit("typing:start", isGroup ? { groupId: id } : { peerId: id });
          } catch (err: any) {
            console.warn("[useChatSocket] typing:start emit error:", err?.message || err);
          }
        }
        if (typingSendDebounceRef.current) clearTimeout(typingSendDebounceRef.current);
        typingSendDebounceRef.current = setTimeout(() => {
          typingSendDebounceRef.current = null;
          if (!isTypingSentRef.current) return;
          isTypingSentRef.current = false;
          try {
            socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
          } catch (err: any) {
            console.warn("[useChatSocket] typing:stop emit error (timeout):", err?.message || err);
          }
        }, TYPING_TIMEOUT_MS);
      } else {
        if (typingSendDebounceRef.current) {
          clearTimeout(typingSendDebounceRef.current);
          typingSendDebounceRef.current = null;
        }
        if (!isTypingSentRef.current) return;
        isTypingSentRef.current = false;
        try {
          socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
        } catch (err: any) {
          console.warn("[useChatSocket] typing:stop emit error:", err?.message || err);
        }
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
      if (typingSendDebounceRef.current) {
        clearTimeout(typingSendDebounceRef.current);
        typingSendDebounceRef.current = null;
      }
      if (isTypingSentRef.current && socket) {
        socket.emit("typing:stop", isGroup ? { groupId: id } : { peerId: id });
        isTypingSentRef.current = false;
      }
      setTypingUserIds([]);
    };
  }, [id, isGroup, socket]);

  useEffect(() => {
    if (!id) return;

    let lastCatchupAt = 0;
    const CATCHUP_COOLDOWN_MS = 10_000;

    const fetchLatest = async (force = false) => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = Date.now();
      if (!force && now - lastCatchupAt < CATCHUP_COOLDOWN_MS) return;
      lastCatchupAt = now;

      try {
        const endpoint = isGroup
          ? `/api/groups/${id}/messages?limit=30&last=true`
          : `/api/messages/${id}?limit=30&last=true`;
        const res = await fetch(endpoint, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) {
          console.warn(
            "[useChatSocket] Catchup fetch HTTP",
            res.status,
            "for chat",
            id,
          );
          return;
        }
        const data = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setChatMessages((prev) => mergeUnique(prev, data.messages));
        }
      } catch (error: any) {
        console.warn(
          "[useChatSocket] Catchup message refresh failed:",
          error?.message || error,
        );
      }
    };

    const handleConnect = () => {
      console.log(
        "[useChatSocket] Socket connected — triggering catchup fetch for chat",
        id,
      );
      void fetchLatest(true);
    };
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        console.log(
          "[useChatSocket] Tab became visible — triggering catchup fetch for chat",
          id,
        );
        void fetchLatest(true);
      }
    };
    const handleReconnect = (attempt: number) => {
      console.log(
        "[useChatSocket] Socket reconnected (attempt",
        attempt,
        ") — triggering catchup fetch for chat",
        id,
      );
      void fetchLatest(true);
    };

    socket?.on("connect", handleConnect);
    socket?.io?.on("reconnect", handleReconnect);
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    void fetchLatest(true);

    return () => {
      socket?.off("connect", handleConnect);
      socket?.io?.off("reconnect", handleReconnect);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [id, isGroup, mergeUnique, setChatMessages, socket]);

  return { socket, typingUserIds, sendTyping };
};
