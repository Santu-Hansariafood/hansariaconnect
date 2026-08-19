import { useEffect, useCallback } from "react";
import { useSocket } from "../useSocket";

export const useChatSocket = (
  id: string,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  mergeUnique: (prev: any[], incoming: any[]) => any[],
  onIncomingMessage?: (msg: any) => void,
  isGroup: boolean = false,
) => {
  const { socket, addListener, removeListener } = useSocket();

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

  useEffect(() => {
    addListener("message:new", handleNewDirectMessage);
    addListener("group:message:new", handleNewGroupMessage);
    addListener("message:status:update", handleStatusUpdate);

    return () => {
      removeListener("message:new", handleNewDirectMessage);
      removeListener("group:message:new", handleNewGroupMessage);
      removeListener("message:status:update", handleStatusUpdate);
    };
  }, [
    addListener,
    removeListener,
    handleNewDirectMessage,
    handleNewGroupMessage,
    handleStatusUpdate,
  ]);

  useEffect(() => {
    if (!id) return;

    let interval: any = null;
    const fetchLatest = async () => {
      try {
        const endpoint = isGroup
          ? `/api/groups/${id}/messages?limit=30&last=true`
          : `/api/messages/${id}?limit=30&last=true`;
        const res = await fetch(`${endpoint}&t=${Date.now()}`, {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setChatMessages((prev) => mergeUnique(prev, data.messages));
        }
      } catch (e) {
        // ignore polling errors silently
      }
    };

    fetchLatest();
    interval = setInterval(fetchLatest, 5000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [id, isGroup, setChatMessages, mergeUnique]);

  return socket;
};
