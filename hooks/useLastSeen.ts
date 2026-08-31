"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./useSocket";

interface LastSeenEntry {
  timestamp: Date | null;
  isOnline: boolean;
}

interface LastSeenTracker {
  [userId: string]: LastSeenEntry;
}

interface LastSeenPayload {
  userId?: string;
  lastSeenAt?: string | Date | null;
}

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

let lastSeenCache: LastSeenTracker = {};

const loadingPromises: Record<string, Promise<void>> = {};

const isValidObjectId = (id: string): boolean => {
  return OBJECT_ID_REGEX.test(id);
};

const format12Hour = (date: Date): string => {
  let hours = date.getHours();

  const minutes = date.getMinutes();

  const ampm = hours >= 12 ? "PM" : "AM";

  hours %= 12;
  hours = hours || 12;

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");

  return `${hh}:${mm} ${ampm}`;
};

const startOfDay = (date: Date): Date => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameDay = (a: Date, b: Date): boolean => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const getCalendarDayDifference = (from: Date, to: Date): number => {
  const fromDay = startOfDay(from).getTime();
  const toDay = startOfDay(to).getTime();

  return Math.round((fromDay - toDay) / DAY_MS);
};

const format12HourWithDate = (date: Date): string => {
  const now = new Date();

  const diffDays = getCalendarDayDifference(now, date);

  const timeStr = format12Hour(date);

  if (diffDays === 0) {
    return `${timeStr} today`;
  }

  if (diffDays === 1) {
    return `${timeStr} yesterday`;
  }

  if (diffDays > 1 && diffDays < 7) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    return `${timeStr} ${days[date.getDay()]}`;
  }

  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${timeStr} ${month}/${day}/${year}`;
};

export const formatLastSeenText = (
  isUserOnline: boolean,
  seenAt: Date | null,
): string => {
  if (isUserOnline) {
    return "Online";
  }

  if (!seenAt || Number.isNaN(seenAt.getTime())) {
    return "Last seen: No info";
  }

  const now = new Date();

  let diffMs = now.getTime() - seenAt.getTime();

  // Protect against small clock differences between client/server.
  if (diffMs < 0) {
    diffMs = 0;
  }

  const diffMins = Math.floor(diffMs / MINUTE_MS);
  const diffHours = Math.floor(diffMs / HOUR_MS);

  const calendarDiff = getCalendarDayDifference(now, seenAt);

  if (diffMins < 1) {
    return `Last seen: just now · ${format12Hour(seenAt)}`;
  }

  if (diffMins < 60 && calendarDiff === 0) {
    return `Last seen: ${diffMins} min ago · ${format12Hour(seenAt)}`;
  }

  if (calendarDiff === 0) {
    return `Last seen: today at ${format12Hour(seenAt)}`;
  }

  if (calendarDiff === 1) {
    return `Last seen: yesterday at ${format12Hour(seenAt)}`;
  }

  if (diffHours < 24) {
    return `Last seen: ${diffHours} hr ago · ${format12HourWithDate(seenAt)}`;
  }

  return `Last seen: ${format12HourWithDate(seenAt)}`;
};

const fetchLastSeenFromApi = async (
  userIds: string[],
): Promise<Record<string, Date | null>> => {
  const result: Record<string, Date | null> = {};

  if (userIds.length === 0) {
    return result;
  }

  const validIds = [
    ...new Set(userIds.filter((id) => id && isValidObjectId(id))),
  ];

  if (validIds.length === 0) {
    return result;
  }

  try {
    const q = encodeURIComponent(JSON.stringify(validIds));

    const response = await fetch(`/api/last-seen?ids=${q}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return result;
    }

    const data = await response.json();

    const users = data?.users ?? {};

    for (const userId of validIds) {
      const entry = users[userId];

      if (entry?.lastSeen) {
        const date = new Date(entry.lastSeen);

        if (!Number.isNaN(date.getTime())) {
          result[userId] = date;
        } else {
          result[userId] = null;
        }
      } else {
        result[userId] = null;
      }
    }
  } catch {
    // Ignore API errors.
  }

  return result;
};

export const preloadLastSeenForUsers = async (
  userIds: string[],
): Promise<void> => {
  const validIds = [
    ...new Set(userIds.filter((id) => id && isValidObjectId(id))),
  ];

  if (validIds.length === 0) {
    return;
  }

  const needFetch = validIds.filter((userId) => {
    return !Object.prototype.hasOwnProperty.call(lastSeenCache, userId);
  });

  if (needFetch.length === 0) {
    return;
  }

  const cacheKey = needFetch.slice().sort().join(",");

  if (loadingPromises[cacheKey]) {
    await loadingPromises[cacheKey];
    return;
  }

  const promise = (async () => {
    try {
      const serverData = await fetchLastSeenFromApi(needFetch);

      for (const userId of needFetch) {
        const existing = lastSeenCache[userId];

        const serverTimestamp =
          serverData[userId] !== undefined ? serverData[userId] : null;

        lastSeenCache[userId] = {
          timestamp: serverTimestamp ?? existing?.timestamp ?? null,
          isOnline: existing?.isOnline ?? false,
        };
      }
    } finally {
      delete loadingPromises[cacheKey];
    }
  })();

  loadingPromises[cacheKey] = promise;

  await promise;
};

export const updateLastSeenCache = (
  userId: string,
  timestamp: Date | null,
): void => {
  if (!userId || !isValidObjectId(userId)) {
    return;
  }

  lastSeenCache[userId] = {
    timestamp,
    isOnline: lastSeenCache[userId]?.isOnline ?? false,
  };
};

export const clearLastSeenCache = (userId?: string): void => {
  if (userId) {
    delete lastSeenCache[userId];
    return;
  }

  lastSeenCache = {};

  for (const key of Object.keys(loadingPromises)) {
    delete loadingPromises[key];
  }
};

export const useLastSeen = (userId: string | undefined) => {
  const { onlineUserIds, addListener, removeListener } = useSocket();

  const [lastSeenTime, setLastSeenTime] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [statusText, setStatusText] = useState<string>("Last seen: Loading...");

  const mountedRef = useRef(true);
  const previousOnlineRef = useRef(false);
  const initialFetchRef = useRef<string | null>(null);

  const computeStatus = useCallback(
    (online: boolean, timestamp: Date | null) => {
      return formatLastSeenText(online, timestamp);
    },
    [],
  );

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsOnline(false);
      setLastSeenTime(null);
      setStatusText("Last seen: No info");

      previousOnlineRef.current = false;
      initialFetchRef.current = null;

      return;
    }

    let cancelled = false;

    const applyCurrentState = () => {
      if (cancelled || !mountedRef.current) {
        return;
      }

      const userIsOnline = onlineUserIds.includes(userId);
      const cached = lastSeenCache[userId];
      const timestamp = cached?.timestamp ?? null;

      setIsOnline(userIsOnline);
      setLastSeenTime(timestamp);
      setStatusText(computeStatus(userIsOnline, timestamp));

      previousOnlineRef.current = userIsOnline;

      if (cached) {
        lastSeenCache[userId] = {
          timestamp: cached.timestamp,
          isOnline: userIsOnline,
        };
      } else {
        lastSeenCache[userId] = {
          timestamp: null,
          isOnline: userIsOnline,
        };
      }
    };

    const loadInitialData = async () => {
      await preloadLastSeenForUsers([userId]);

      if (cancelled || !mountedRef.current) {
        return;
      }

      applyCurrentState();
    };

    applyCurrentState();

    if (initialFetchRef.current !== userId) {
      initialFetchRef.current = userId;
      void loadInitialData();
    }

    return () => {
      cancelled = true;
    };
  }, [userId, onlineUserIds, computeStatus]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const onLastSeenUpdate = (payload: LastSeenPayload) => {
      const uid = String(payload?.userId ?? "");

      if (!uid || uid !== userId) {
        return;
      }

      const rawLastSeen = payload?.lastSeenAt;

      if (!rawLastSeen) {
        return;
      }

      const date = new Date(rawLastSeen);

      if (Number.isNaN(date.getTime())) {
        return;
      }

      const currentlyOnline = onlineUserIds.includes(uid);

      lastSeenCache[uid] = {
        timestamp: date,
        isOnline: currentlyOnline,
      };

      if (!mountedRef.current) {
        return;
      }

      if (currentlyOnline) {
        setIsOnline(true);
        setLastSeenTime(date);
        setStatusText("Online");
      } else {
        setIsOnline(false);
        setLastSeenTime(date);
        setStatusText(computeStatus(false, date));
      }
    };

    addListener("user:last-seen", onLastSeenUpdate);

    return () => {
      removeListener("user:last-seen", onLastSeenUpdate);
    };
  }, [userId, onlineUserIds, addListener, removeListener, computeStatus]);

  useEffect(() => {
    if (!userId || !mountedRef.current) {
      return;
    }

    const currentlyOnline = onlineUserIds.includes(userId);
    const wasOnline = previousOnlineRef.current;

    if (!wasOnline && currentlyOnline) {
      const cached = lastSeenCache[userId];

      lastSeenCache[userId] = {
        timestamp: cached?.timestamp ?? null,
        isOnline: true,
      };

      setIsOnline(true);
      setLastSeenTime(cached?.timestamp ?? null);
      setStatusText("Online");
    }

    if (wasOnline && !currentlyOnline) {
      const cached = lastSeenCache[userId];

      const timestamp = cached?.timestamp ?? null;

      lastSeenCache[userId] = {
        timestamp,
        isOnline: false,
      };

      setIsOnline(false);
      setLastSeenTime(timestamp);
      setStatusText(computeStatus(false, timestamp));
    }

    previousOnlineRef.current = currentlyOnline;
  }, [userId, onlineUserIds, computeStatus]);

  useEffect(() => {
    if (!userId || isOnline || !lastSeenTime) {
      return;
    }

    const updateStatus = () => {
      if (!mountedRef.current) {
        return;
      }

      setStatusText(computeStatus(false, lastSeenTime));
    };

    updateStatus();

    const interval = window.setInterval(updateStatus, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [userId, isOnline, lastSeenTime, computeStatus]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      const cached = lastSeenCache[userId];

      const currentlyOnline = onlineUserIds.includes(userId);

      if (currentlyOnline) {
        setIsOnline(true);
        setLastSeenTime(cached?.timestamp ?? null);
        setStatusText("Online");
      } else {
        const timestamp = cached?.timestamp ?? null;

        setIsOnline(false);
        setLastSeenTime(timestamp);
        setStatusText(computeStatus(false, timestamp));
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [userId, onlineUserIds, computeStatus]);

  return {
    lastSeenTime,
    isOnline,
    statusText,
  };
};
