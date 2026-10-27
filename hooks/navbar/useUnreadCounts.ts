"use client";

import { useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/useSocket";
import {
  ApiCacheTTL,
  cachedFetch,
  invalidateApiCache,
} from "@/lib/api/clientCache";

/** Socket push is the primary source; this is only a keep-alive safety net. */
const SAFETY_POLL_MS = 180_000;
const UNREAD_ENDPOINT = "/api/unread-counts";

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
  const { addListener, removeListener } = useSocket({ subscribeOnline: false });
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

    const nextCounts = {
      total: Math.max(0, total),
      chats: Math.max(0, chatsUnread),
      groups: Math.max(0, groupsUnread),
    };
    setCounts((previous) =>
      previous.total === nextCounts.total &&
      previous.chats === nextCounts.chats &&
      previous.groups === nextCounts.groups
        ? previous
        : nextCounts,
    );
  };

  useEffect(() => {
    const loadUnread = async () => {
      try {
        const res = await cachedFetch(UNREAD_ENDPOINT, {
          cache: "no-store",
          credentials: "include",
          ttlMs: ApiCacheTTL.realtime,
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
    const interval = setInterval(loadUnread, SAFETY_POLL_MS);

    const onUnreadUpdate = (payload: UnreadResponse) => {
      if (!payload || typeof payload !== "object") return;
      // The socket holds the authoritative counts; drop the cached copy so a
      // later poll cannot revert the badge to a pre-event value.
      invalidateApiCache(UNREAD_ENDPOINT);
      parseResponse(payload);
    };

    const onConversationRead = () => {
      invalidateApiCache(UNREAD_ENDPOINT);
      void loadUnread();
    };
    const onGroupRead = () => {
      invalidateApiCache(UNREAD_ENDPOINT);
      void loadUnread();
    };

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
