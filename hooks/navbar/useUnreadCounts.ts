"use client";
import { useEffect, useState } from "react";

export function useUnreadCounts() {
  const [counts, setCounts] = useState({
    total: 0,
    chats: 0,
    groups: 0,
  });

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await fetch("/api/unread-counts", {
          cache: "no-store",
        });

        const data = await res.json();
        if (!res.ok) return;

        const chatsUnread = Object.values(data.conversations || {}).reduce(
          (a: any, b: any) => a + b,
          0
        );

        const groupsUnread = Object.values(data.groups || {}).reduce(
          (a: any, b: any) => a + b,
          0
        );

        setCounts({
          total: data.total || 0,
          chats: chatsUnread,
          groups: groupsUnread,
        });
      } catch {}
    };

    loadUnread();
    const interval = setInterval(loadUnread, 10000);

    return () => clearInterval(interval);
  }, []);

  return counts;
}
