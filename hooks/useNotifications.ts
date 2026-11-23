import { useCallback, useEffect, useRef, useState } from "react";
import { ensurePushSubscription } from "@/lib/pushClient";
import {
  ApiCacheTTL,
  cachedFetch,
  invalidateApiCache,
} from "@/lib/api/clientCache";

export interface NotificationPreferences {
  messages: boolean;
  groups: boolean;
  enabled: boolean;
  ringtone: string;
}

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  messages: true,
  groups: true,
  enabled: true,
  ringtone: "whatsapp",
};

let notificationPreferencesSnapshot = {
  ...DEFAULT_NOTIFICATION_PREFERENCES,
};

let notificationPreferencesLoaded = false;
let notificationPreferencesPromise: Promise<NotificationPreferences> | null =
  null;

let notificationPreferencesUserId: string | null = null;
let notificationPreferencesPromiseUserId: string | null = null;

const notificationSubscribers = new Set<
  (preferences: NotificationPreferences) => void
>();

const arePreferencesEqual = (
  a: NotificationPreferences,
  b: NotificationPreferences,
) =>
  a.messages === b.messages &&
  a.groups === b.groups &&
  a.enabled === b.enabled &&
  a.ringtone === b.ringtone;

const publishNotificationPreferences = (next: NotificationPreferences) => {
  if (!arePreferencesEqual(notificationPreferencesSnapshot, next)) {
    notificationPreferencesSnapshot = next;

    notificationSubscribers.forEach((subscriber) => {
      subscriber(next);
    });
  }

  return notificationPreferencesSnapshot;
};

const normalizePreferences = (
  value: Partial<NotificationPreferences> | undefined,
): NotificationPreferences => ({
  messages:
    typeof value?.messages === "boolean"
      ? value.messages
      : DEFAULT_NOTIFICATION_PREFERENCES.messages,

  groups:
    typeof value?.groups === "boolean"
      ? value.groups
      : DEFAULT_NOTIFICATION_PREFERENCES.groups,

  enabled:
    typeof value?.enabled === "boolean"
      ? value.enabled
      : DEFAULT_NOTIFICATION_PREFERENCES.enabled,

  ringtone:
    typeof value?.ringtone === "string"
      ? value.ringtone
      : DEFAULT_NOTIFICATION_PREFERENCES.ringtone,
});

const loadNotificationPreferences = async (
  userId?: string | number,
): Promise<NotificationPreferences> => {
  const requestedUserId = userId == null ? null : String(userId);

  if (!requestedUserId) {
    notificationPreferencesUserId = null;
    notificationPreferencesLoaded = true;
    notificationPreferencesPromise = null;
    notificationPreferencesPromiseUserId = null;

    return publishNotificationPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    });
  }

  if (
    notificationPreferencesLoaded &&
    notificationPreferencesUserId === requestedUserId
  ) {
    return notificationPreferencesSnapshot;
  }

  if (
    notificationPreferencesPromise &&
    notificationPreferencesPromiseUserId === requestedUserId
  ) {
    return notificationPreferencesPromise;
  }

  if (notificationPreferencesUserId !== requestedUserId) {
    notificationPreferencesUserId = requestedUserId;
    notificationPreferencesLoaded = false;

    publishNotificationPreferences({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    });
  }

  notificationPreferencesPromiseUserId = requestedUserId;

  const requestHolder: {
    promise?: Promise<NotificationPreferences>;
  } = {};
  const request = (async () => {
    try {
      const response = await cachedFetch("/api/settings", {
        credentials: "include",
        cache: "no-store",
        ttlMs: ApiCacheTTL.long,
      });

      if (!response.ok) {
        throw new Error(`Settings request failed: ${response.status}`);
      }

      const data = await response.json();

      if (notificationPreferencesUserId !== requestedUserId) {
        return DEFAULT_NOTIFICATION_PREFERENCES;
      }

      return publishNotificationPreferences(
        normalizePreferences(data?.notifications),
      );
    } catch (error) {
      console.error("[Notifications] Failed to load preferences:", error);

      return notificationPreferencesSnapshot;
    } finally {
      if (notificationPreferencesUserId === requestedUserId) {
        notificationPreferencesLoaded = true;
      }

      if (notificationPreferencesPromise === requestHolder.promise) {
        notificationPreferencesPromise = null;
        notificationPreferencesPromiseUserId = null;
      }
    }
  })();

  requestHolder.promise = request;
  notificationPreferencesPromise = request;

  return request;
};

const subscribeToNotificationPreferences = (
  subscriber: (preferences: NotificationPreferences) => void,
) => {
  notificationSubscribers.add(subscriber);

  return () => {
    notificationSubscribers.delete(subscriber);
  };
};

type RingtoneNote = {
  start: number;
  duration: number;
  freq: number;
  volume?: number;
  type?: OscillatorType;
};

const ringtonePatterns: Record<string, RingtoneNote[]> = {
  whatsapp: [
    {
      start: 0,
      duration: 0.16,
      freq: 1174.66,
      volume: 0.3,
    },
    {
      start: 0.11,
      duration: 0.42,
      freq: 1567.98,
      volume: 0.26,
    },
  ],

  chime: [
    { start: 0, duration: 0.18, freq: 1200 },
    { start: 0.22, duration: 0.22, freq: 900 },
    { start: 0.48, duration: 0.28, freq: 1500 },
  ],

  pulse: [
    { start: 0, duration: 0.12, freq: 900 },
    { start: 0.14, duration: 0.12, freq: 900 },
    { start: 0.3, duration: 0.16, freq: 1100 },
  ],

  spark: [
    { start: 0, duration: 0.08, freq: 1600 },
    { start: 0.1, duration: 0.1, freq: 1200 },
    { start: 0.22, duration: 0.14, freq: 1800 },
  ],

  bell: [
    {
      start: 0,
      duration: 0.35,
      freq: 880,
      type: "triangle",
    },
    {
      start: 0.04,
      duration: 0.3,
      freq: 1318,
      type: "triangle",
    },
  ],

  none: [],
};

const getAudioContextCtor = (): (new () => AudioContext) | null => {
  if (typeof window === "undefined") return null;

  const audioWindow = window as typeof window & {
    webkitAudioContext?: new () => AudioContext;
  };

  return window.AudioContext || audioWindow.webkitAudioContext || null;
};

const NOTIFICATION_VIBRATION: number[] = [0, 200, 100, 200];
const DEFAULT_NOTIFICATION_ICON = "/favicon/android-chrome-192x192.png";

/** How long to wait for a usable service worker before falling back. */
const SERVICE_WORKER_WAIT_MS = 3000;

const toAbsoluteUrl = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  if (
    /^https?:\/\//i.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }
  if (typeof window === "undefined") return value;
  try {
    return new URL(value, window.location.origin).href;
  } catch {
    return value;
  }
};

/**
 * Update the PWA home-screen app badge (WhatsApp-style unread count).
 * Supported in Chrome/Edge (desktop + Android) and iOS 16.4+ standalone.
 * Silently no-ops where the API is unavailable.
 */
const setAppBadge = (count: number) => {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0 && typeof nav.setAppBadge === "function") {
      void nav.setAppBadge(count);
    } else if (typeof nav.clearAppBadge === "function") {
      void nav.clearAppBadge();
    }
  } catch {
    /* badge unsupported – ignore */
  }
};

export function useNotifications(userId?: string | number) {
  const normalizedUserId = userId == null ? null : String(userId);

  const [preferencesState, setPreferencesState] = useState(() => ({
    userId: normalizedUserId,
    value: notificationPreferencesSnapshot,
  }));
  const preferences =
    preferencesState.userId === normalizedUserId
      ? preferencesState.value
      : DEFAULT_NOTIFICATION_PREFERENCES;

  const [preferencesLoadedState, setPreferencesLoadedState] = useState(() => ({
    userId: normalizedUserId,
    value:
      notificationPreferencesLoaded &&
      notificationPreferencesUserId === normalizedUserId,
  }));
  const preferencesLoaded =
    preferencesLoadedState.userId === normalizedUserId &&
    preferencesLoadedState.value;

  const [pushState, setPushState] = useState(() => ({
    userId: normalizedUserId,
    ready: false,
  }));
  const pushReady = pushState.userId === normalizedUserId && pushState.ready;

  const audioContextRef = useRef<AudioContext | null>(null);

  const customAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeUserIdRef = useRef<string | null>(normalizedUserId);

  const pushSyncInProgressRef = useRef(false);

  useEffect(() => {
    activeUserIdRef.current = normalizedUserId;

    const unsubscribe = subscribeToNotificationPreferences((next) => {
      if (activeUserIdRef.current === notificationPreferencesUserId) {
        setPreferencesState({
          userId: activeUserIdRef.current,
          value: next,
        });
      }
    });

    void loadNotificationPreferences(normalizedUserId ?? undefined).then(
      (loaded) => {
        if (activeUserIdRef.current !== normalizedUserId) {
          return;
        }

        setPreferencesState({
          userId: normalizedUserId,
          value: loaded,
        });
        setPreferencesLoadedState({
          userId: normalizedUserId,
          value: true,
        });
      },
    );

    return unsubscribe;
  }, [normalizedUserId]);

  const updatePreferences = useCallback(
    async (
      updater:
        | Partial<NotificationPreferences>
        | ((
            current: NotificationPreferences,
          ) => NotificationPreferences | Partial<NotificationPreferences>),
    ) => {
      await loadNotificationPreferences(userId);

      if (notificationPreferencesUserId !== normalizedUserId) {
        throw new Error("Notification account changed.");
      }

      const previous = notificationPreferencesSnapshot;

      const resolved =
        typeof updater === "function" ? updater(previous) : updater;

      const next = normalizePreferences({
        ...previous,
        ...resolved,
      });

      publishNotificationPreferences(next);

      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            notifications: next,
          }),
        });

        if (!response.ok) {
          throw new Error(`Settings update failed: ${response.status}`);
        }

        invalidateApiCache("/api/settings");

        return next;
      } catch (error) {
        if (notificationPreferencesUserId === normalizedUserId) {
          publishNotificationPreferences(previous);
        }

        console.error("[Notifications] Failed to save preferences:", error);

        throw error;
      }
    },
    [userId, normalizedUserId],
  );

  const clearCustomRingtone = useCallback(() => {
    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      customAudioRef.current = null;
    }
  }, []);

  const playRingtone = useCallback(
    async (ringtone: string) => {
      if (
        typeof window === "undefined" ||
        !preferences.enabled ||
        ringtone === "none"
      ) {
        return;
      }

      clearCustomRingtone();

      const isUrl =
        /^https?:\/\//i.test(ringtone) || ringtone.startsWith("blob:");

      if (isUrl) {
        try {
          const audio = new Audio(ringtone);

          audio.volume = 0.35;
          customAudioRef.current = audio;

          audio.onended = () => {
            if (customAudioRef.current === audio) {
              customAudioRef.current = null;
            }
          };

          await audio.play();
        } catch (error) {
          console.warn("[Notifications] Audio playback failed:", error);
        }

        return;
      }

      const AudioCtx = getAudioContextCtor();

      if (!AudioCtx) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }

        const context = audioContextRef.current;

        if (context.state === "suspended") {
          await context.resume();
        }

        if (context.state !== "running") return;

        const pattern = ringtonePatterns[ringtone] || ringtonePatterns.chime;

        const now = context.currentTime;

        const master = context.createGain();

        master.gain.setValueAtTime(0.75, now);
        master.connect(context.destination);

        pattern.forEach((note) => {
          const oscillator = context.createOscillator();

          const gain = context.createGain();

          const startAt = now + note.start;
          const endAt = startAt + note.duration;

          oscillator.type = note.type || "sine";

          oscillator.frequency.setValueAtTime(note.freq, startAt);

          gain.gain.setValueAtTime(0.0001, startAt);

          gain.gain.linearRampToValueAtTime(
            note.volume ?? 0.15,
            startAt + 0.008,
          );

          gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

          oscillator.connect(gain);
          gain.connect(master);

          oscillator.start(startAt);
          oscillator.stop(endAt + 0.03);
        });

        const totalDuration =
          Math.max(0, ...pattern.map((note) => note.start + note.duration)) +
          0.1;

        setTimeout(() => {
          try {
            master.disconnect();
          } catch {
            // Already disconnected.
          }
        }, totalDuration * 1000);
      } catch (error) {
        console.warn("[Notifications] Could not play ringtone:", error);
      }
    },
    [clearCustomRingtone, preferences.enabled],
  );

  const playStartupTune = useCallback(
    async (ringtone: string) => {
      if (
        typeof window === "undefined" ||
        !preferences.enabled ||
        ringtone === "none"
      ) {
        return;
      }

      await playRingtone(ringtone);
    },
    [playRingtone, preferences.enabled],
  );

  const syncPushSubscription = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPushState({ userId: normalizedUserId, ready: false });
      return false;
    }

    if (Notification.permission !== "granted" || !normalizedUserId) {
      setPushState({ userId: normalizedUserId, ready: false });
      return false;
    }

    if (pushSyncInProgressRef.current) {
      return pushReady;
    }

    pushSyncInProgressRef.current = true;

    try {
      const ready = await ensurePushSubscription();

      if (activeUserIdRef.current !== normalizedUserId) {
        return false;
      }

      setPushState({
        userId: normalizedUserId,
        ready: Boolean(ready),
      });

      return Boolean(ready);
    } catch (error) {
      console.error("[Notifications] Push subscription sync failed:", error);

      setPushState({ userId: normalizedUserId, ready: false });

      return false;
    } finally {
      pushSyncInProgressRef.current = false;
    }
  }, [normalizedUserId, pushReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    void Promise.resolve().then(syncPushSubscription);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncPushSubscription();
      }
    };

    const handleFocus = () => {
      void syncPushSubscription();
    };

    document.addEventListener("visibilitychange", handleVisibility);

    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);

      window.removeEventListener("focus", handleFocus);
    };
  }, [syncPushSubscription]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("[Notifications] Notification API unavailable.");

      return false;
    }

    try {
      let permission = Notification.permission;

      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      if (permission !== "granted") {
        setPushState({ userId: normalizedUserId, ready: false });
        return false;
      }

      return await syncPushSubscription();
    } catch (error) {
      console.error("[Notifications] Permission request failed:", error);

      return false;
    }
  }, [normalizedUserId, syncPushSubscription]);

  const showNotification = useCallback(
    async (
      title: string,
      body: string,
      tag?: string,
      url = "/chat",
      silent = false,
      image?: string,
      messageId?: string,
      icon?: string,
    ) => {
      if (!preferences.enabled) {
        console.warn(
          "[Notifications] Skipped: notifications are disabled in preferences.",
        );
        return false;
      }

      if (typeof window === "undefined" || !("Notification" in window)) {
        console.warn("[Notifications] Notification API is unavailable.");
        return false;
      }

      if (Notification.permission !== "granted") {
        console.warn(
          "[Notifications] Cannot show system notification; permission is",
          Notification.permission,
        );
        return false;
      }

      const iconUrl =
        toAbsoluteUrl(icon) || toAbsoluteUrl(DEFAULT_NOTIFICATION_ICON);
      const badgeUrl = toAbsoluteUrl(DEFAULT_NOTIFICATION_ICON);
      const imageUrl = toAbsoluteUrl(image);
      const targetUrl = toAbsoluteUrl(url) || url;

      const options: NotificationOptions & {
        renotify: boolean;
        vibrate: number[] | undefined;
        timestamp: number;
        actions?: Array<{ action: string; title: string }>;
      } = {
        body,
        icon: iconUrl,
        badge: badgeUrl,
        tag,
        renotify: Boolean(tag) && !silent,
        silent,
        requireInteraction: !silent,
        vibrate: silent ? undefined : NOTIFICATION_VIBRATION,
        timestamp: Date.now(),
        data: {
          url: targetUrl,
          tag,
          messageId,
        },
        ...(imageUrl ? { image: imageUrl } : {}),
      };
      const serviceWorkerOptions = {
        ...options,
        actions: [{ action: "open", title: "Open chat" }],
      };

      const showWindowNotification = () => {
        if (typeof Notification !== "function") {
          console.error(
            "[Notifications] Window notification fallback is unavailable.",
          );
          return false;
        }

        try {
          const notification = new Notification(title, options);

          notification.onclick = () => {
            window.focus();
            window.location.assign(targetUrl);
            notification.close();
          };

          return true;
        } catch (error) {
          console.error(
            "[Notifications] Window notification fallback failed:",
            error,
          );
          return false;
        }
      };

      try {
        if ("serviceWorker" in navigator) {
          const registration =
            (await navigator.serviceWorker.getRegistration()) ??
            (await Promise.race([
              navigator.serviceWorker.ready,
              new Promise<ServiceWorkerRegistration | null>((resolve) =>
                setTimeout(() => resolve(null), SERVICE_WORKER_WAIT_MS),
              ),
            ]));

          if (registration?.active) {
            let count = 1;
            let messageIds: string[] = [];

            if (tag) {
              const shown = await registration
                .getNotifications({ tag })
                .catch(() => [] as Notification[]);

              const previousData = (shown[0]?.data || {}) as {
                messageId?: string;
                count?: number;
                messageIds?: string[];
              };

              const previousIds = Array.isArray(previousData.messageIds)
                ? previousData.messageIds
                : previousData.messageId
                  ? [previousData.messageId]
                  : [];

              if (messageId && previousIds.includes(messageId)) {
                console.log(
                  "[Notifications] This device already shows this message; skipping the duplicate.",
                );
                return true;
              }

              messageIds = messageId
                ? [...previousIds, messageId].slice(-25)
                : previousIds;

              count = messageId
                ? (typeof previousData.count === "number"
                    ? previousData.count
                    : 0) + 1
                : 1;
            }

            // WhatsApp keeps the *latest* message visible in the body when
            // several messages stack under the same tag. The unread total
            // is reflected on the PWA app badge (see NotificationManager).
            await registration.showNotification(title, {
              ...serviceWorkerOptions,
              body,
              data: {
                url: targetUrl,
                tag,
                messageId,
                count,
                messageIds,
              },
            });
            console.log(
              "[Notifications] System notification shown by service worker.",
            );
            return true;
          }
        }

        console.warn(
          "[Notifications] No active service worker; using the window notification fallback.",
        );
        return showWindowNotification();
      } catch (error) {
        console.error(
          "[Notifications] Service worker notification failed; trying the window fallback:",
          error,
        );
        return showWindowNotification();
      }
    },
    [preferences.enabled],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlockAudio = () => {
      const AudioCtx = getAudioContextCtor();

      if (!AudioCtx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }

      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });

    window.addEventListener("keydown", unlockAudio);

    window.addEventListener("touchstart", unlockAudio, { passive: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);

      window.removeEventListener("keydown", unlockAudio);

      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearCustomRingtone();

      if (audioContextRef.current) {
        void audioContextRef.current.close().catch(() => {});

        audioContextRef.current = null;
      }
    };
  }, [clearCustomRingtone]);

  return {
    preferences,
    preferencesLoaded,
    pushReady,

    showNotification,
    requestPermission,

    playRingtone,
    playStartupTune,

    updatePreferences,

    // NEW: WhatsApp-style PWA home-screen unread badge
    setAppBadge,
  };
}
