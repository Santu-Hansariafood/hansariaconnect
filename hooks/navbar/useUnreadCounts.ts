"use client";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await fetch("/api/unread-counts", {
          cache: "no-store",
          credentials: "include",
        });

        const data: UnreadResponse = await res.json();
        if (!res.ok) return;

        // Safe numeric reduction
        const chatsUnread = Object.values(data.conversations || {}).reduce(
          (a, b) => a + Number(b || 0),
          0
        );

        const groupsUnread = Object.values(data.groups || {}).reduce(
          (a, b) => a + Number(b || 0),
          0
        );

        setCounts({
          total: Number(data.total || 0),
          chats: chatsUnread,
          groups: groupsUnread,
        });
      } catch {
        // ignore
      }
    };

    loadUnread();
    const interval = setInterval(loadUnread, 10000);

    // listen for server-side read events to refresh counts immediately
    const onConversationRead = () => loadUnread();
    const onGroupRead = () => loadUnread();
    addListener("conversation:read", onConversationRead);
    addListener("group:read", onGroupRead);

    return () => {
      clearInterval(interval);
      removeListener("conversation:read", onConversationRead);
      removeListener("group:read", onGroupRead);
    };
  }, []);

  return counts;
}
