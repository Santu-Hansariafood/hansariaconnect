"use client";

import { useEffect, useState, useCallback } from "react";
import { useSocket } from "./useSocket";

interface LastSeenTracker {
  [userId: string]: {
    timestamp: Date;
    isOnline: boolean;
  };
}

let lastSeenCache: LastSeenTracker = {};

export const useLastSeen = (userId: string | undefined) => {
  const { onlineUserIds, addListener, removeListener } = useSocket();
  const [lastSeenTime, setLastSeenTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [statusText, setStatusText] = useState<string>("offline");

  const calculateStatusText = useCallback((isUserOnline: boolean, seenAt: Date | null): string => {
    if (isUserOnline) {
      return "online";
    }

    if (!seenAt) {
      return "offline";
    }

    const now = new Date();
    const diffMs = now.getTime() - seenAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {
      return "just now";
    } else if (diffMins < 60) {
      return `last seen ${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `last seen ${diffHours}h ago`;
    } else if (diffDays === 1) {
      return "last seen yesterday";
    } else if (diffDays < 7) {
      return `last seen ${diffDays}d ago`;
    } else {
      const options: Intl.DateTimeFormatOptions = {
        month: "short",
        day: "numeric",
      };
      return `last seen ${seenAt.toLocaleDateString(undefined, options)}`;
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsOnline(false);
      setLastSeenTime(null);
      setStatusText("offline");
      return;
    }

    const userIsOnline = onlineUserIds.includes(userId);
    const cached = lastSeenCache[userId];

    if (userIsOnline) {
      setIsOnline(true);
      setLastSeenTime(new Date());
      lastSeenCache[userId] = { timestamp: new Date(), isOnline: true };
    } else if (cached) {
      setIsOnline(false);
      setLastSeenTime(cached.timestamp);
    } else {
      setIsOnline(false);
      setLastSeenTime(null);
    }

    setStatusText(calculateStatusText(userIsOnline, userIsOnline ? new Date() : cached?.timestamp || null));
  }, [userId, onlineUserIds, calculateStatusText]);

  // Update status text every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (userId && !isOnline && lastSeenTime) {
        setStatusText(calculateStatusText(false, lastSeenTime));
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [userId, isOnline, lastSeenTime, calculateStatusText]);

  return {
    lastSeenTime,
    isOnline,
    statusText,
  };
};
