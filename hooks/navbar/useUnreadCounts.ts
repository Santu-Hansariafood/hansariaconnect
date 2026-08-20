"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";

type UnreadResponse = {
  total?: number;
  conversations?: Record<string, number>;
  groups?: Record<string, number>;
};

export function useUnreadCounts() {
  const [counts, setCounts] = useState({
    total: 0,
    chats: 0,
    groups: 0,
  });
  const { addListener, removeListener } = useSocket();
  const loadedRef = useRef(false);

  const parseResponse = (data: UnreadResponse) => {
    const chatsUnread = Object.values(data.conversations || {}).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const groupsUnread = Object.values(data.groups || {}).reduce(
      (a, b) => a + Number(b || 0),
      0
    );

    const total =
      typeof data.total === "number" ? data.total : chatsUnread + groupsUnread;

    setCounts({
      total: Math.max(0, total),
      chats: Math.max(0, chatsUnread),
      groups: Math.max(0, groupsUnread),
    });
  };

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await fetch("/api/unread-counts", {
          cache: "no-store",
          credentials: "include",
        });

        const data: UnreadResponse = await res.json();
        if (!res.ok) return;

        parseResponse(data);
        loadedRef.current = true;
      } catch {
        // ignore
      }
    };

    loadUnread();
    const interval = setInterval(loadUnread, 15000);

    const onUnreadUpdate = (payload: UnreadResponse) => {
      if (!payload || typeof payload !== "object") return;
      parseResponse(payload);
    };

    const onConversationRead = () => loadUnread();
    const onGroupRead = () => loadUnread();

    addListener("unread:update", onUnreadUpdate);
    addListener("conversation:read", onConversationRead);
    addListener("group:read", onGroupRead);

    return () => {
      clearInterval(interval);
      removeListener("unread:update", onUnreadUpdate);
      removeListener("conversation:read", onConversationRead);
      removeListener("group:read", onGroupRead);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return counts;
}
