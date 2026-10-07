import { useCallback, useEffect, useRef, useState } from "react";

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

let notificationPreferencesSnapshot: NotificationPreferences =
  DEFAULT_NOTIFICATION_PREFERENCES;
let notificationPreferencesLoaded = false;
let notificationPreferencesPromise: Promise<NotificationPreferences> | null = null;
let notificationPreferencesUserId: string | null = null;
let notificationPreferencesPromiseUserId: string | null = null;
const notificationSubscribers = new Set<
  (preferences: NotificationPreferences) => void
>();

const arePreferencesEqual = (
  left: NotificationPreferences,
  right: NotificationPreferences,
) =>
  left.messages === right.messages &&
  left.groups === right.groups &&
  left.enabled === right.enabled &&
  left.ringtone === right.ringtone;

const publishNotificationPreferences = (
  next: NotificationPreferences,
): NotificationPreferences => {
  if (arePreferencesEqual(notificationPreferencesSnapshot, next)) {
    return notificationPreferencesSnapshot;
  }

  notificationPreferencesSnapshot = next;
  notificationSubscribers.forEach((subscriber) => subscriber(next));
  return next;
};

const loadNotificationPreferences = async (
  userId?: string | number,
): Promise<NotificationPreferences> => {
  const requestedUserId = userId == null ? null : String(userId);
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
    publishNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  }

  notificationPreferencesPromiseUserId = requestedUserId;
  const requestHolder: {
    promise?: Promise<NotificationPreferences>;
  } = {};
  const request = (async () => {
    try {
      const res = await fetch("/api/settings", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();
      if (
        res.ok &&
        data?.notifications &&
        notificationPreferencesUserId === requestedUserId
      ) {
        return publishNotificationPreferences({
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          ...data.notifications,
        });
      }
      if (!res.ok) {
        console.warn(
          "[Notifications] Could not load settings. Using defaults.",
          res.status,
        );
      }
    } catch (error) {
      console.error("[Notifications] Failed to load settings:", error);
    } finally {
      if (notificationPreferencesUserId === requestedUserId) {
        notificationPreferencesLoaded = true;
      }
      if (notificationPreferencesPromise === requestHolder.promise) {
        notificationPreferencesPromise = null;
        notificationPreferencesPromiseUserId = null;
      }
    }

    return notificationPreferencesSnapshot;
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

const ringtonePatterns: Record<
  string,
  Array<{ start: number; duration: number; freq: number; type?: OscillatorType; volume?: number }>
> = {
  chime: [
    { start: 0, duration: 0.18, freq: 1200, type: "sine", volume: 0.22 },
    { start: 0.22, duration: 0.22, freq: 900, type: "sine", volume: 0.2 },
    { start: 0.48, duration: 0.28, freq: 1500, type: "sine", volume: 0.18 },
  ],
  pulse: [
    { start: 0, duration: 0.12, freq: 900, type: "sine", volume: 0.2 },
    { start: 0.14, duration: 0.12, freq: 900, type: "sine", volume: 0.2 },
    { start: 0.3, duration: 0.16, freq: 1100, type: "sine", volume: 0.18 },
  ],
  spark: [
    { start: 0, duration: 0.08, freq: 1600, type: "sine", volume: 0.18 },
    { start: 0.1, duration: 0.1, freq: 1200, type: "sine", volume: 0.16 },
    { start: 0.22, duration: 0.14, freq: 1800, type: "sine", volume: 0.14 },
  ],
  whatsapp: [
    { start: 0, duration: 0.12, freq: 1318, type: "sine", volume: 0.25 },
    { start: 0.14, duration: 0.12, freq: 1046, type: "sine", volume: 0.22 },
    { start: 0.3, duration: 0.18, freq: 1568, type: "sine", volume: 0.2 },
    { start: 0.5, duration: 0.22, freq: 2093, type: "sine", volume: 0.18 },
  ],
  bell: [
    { start: 0, duration: 0.35, freq: 880, type: "triangle", volume: 0.2 },
    { start: 0.04, duration: 0.3, freq: 1318, type: "triangle", volume: 0.15 },
    { start: 0.08, duration: 0.25, freq: 1760, type: "triangle", volume: 0.1 },
  ],
  none: [],
};

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
};

export function useNotifications(userId?: string | number) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    notificationPreferencesSnapshot,
  );
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationPreferences(setPreferences);
    void loadNotificationPreferences(userId).then(setPreferences);
    return unsubscribe;
  }, [userId]);

  const updatePreferences = useCallback(
    async (
      updater:
        | Partial<NotificationPreferences>
        | ((
            current: NotificationPreferences,
          ) => NotificationPreferences | Partial<NotificationPreferences>),
    ) => {
      await loadNotificationPreferences(userId);
      const current = notificationPreferencesSnapshot;
      const resolvedUpdate =
        typeof updater === "function" ? updater(current) : updater;
      const next = {
        ...current,
        ...resolvedUpdate,
      };

      publishNotificationPreferences(next);

      try {
        const response = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ notifications: next }),
        });

        if (!response.ok) {
          console.error(
            "[Notifications] Failed to persist settings:",
            response.status,
          );
        }
      } catch (error) {
        console.error("[Notifications] Failed to persist settings:", error);
      }

      return next;
    },
    [userId],
  );

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("[Notifications] requestPermission called but Notification API is unavailable");
      return;
    }
    console.log("[Notifications] Requesting Notification permission (triggered by user gesture)... Current state:", Notification.permission);
    if (Notification.permission === "default") {
      try {
        const result = await Notification.requestPermission();
        console.log("[Notifications] Notification permission result:", result);
      } catch (e: any) {
        console.error("[Notifications] Notification.requestPermission threw an error:", e?.message || e);
      }
    } else {
      console.log("[Notifications] Permission already set to:", Notification.permission, "- no prompt needed");
    }
  }, []);

  const playRingtone = useCallback((ringtone: string) => {
    if (typeof window === "undefined") return;
    if (ringtone === "none") return;
    if (!preferences.enabled) return;

    const isUrl = /^https?:\/\//i.test(ringtone) || ringtone.startsWith("blob:");
    if (isUrl) {
      try {
        const audio = new Audio(ringtone);
        audio.volume = 0.35;
        audio.play().catch((e) => {
          console.warn("[Notifications] Ringtone URL playback failed:", e?.message || e);
        });
      } catch (e: any) {
        console.warn("[Notifications] Custom audio play failed:", e?.message || e);
      }
      return;
    }

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) {
      console.warn("[Notifications] AudioContext not supported in this browser");
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch((e) => console.warn("[Notifications] AudioContext resume failed:", e));
    }

    try {
      const now = ctx.currentTime;
      const pattern = ringtonePatterns[ringtone] || ringtonePatterns.chime;

      pattern.forEach((note) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = note.type || "sine";
        oscillator.frequency.setValueAtTime(note.freq, now + note.start);
        gain.gain.setValueAtTime(note.volume ?? 0.12, now + note.start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.start + note.duration);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(now + note.start);
        oscillator.stop(now + note.start + note.duration + 0.02);
      });
    } catch (e: any) {
      console.warn("[Notifications] Ringtone generation failed:", e?.message || e);
    }
  }, [preferences.enabled]);

  const showNotification = useCallback((title: string, body: string, tag?: string, url = "/chat") => {
    if (!preferences.enabled) {
      console.warn("[Notifications] Skipped: notifications disabled in preferences");
      return;
    }
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      console.warn("[Notifications] Notification API not supported in this browser");
      return;
    }

    const isVisible = document.visibilityState === "visible";
    const isFocused = typeof document.hasFocus === "function" ? document.hasFocus() : isVisible;

    console.log("[Notifications] Attempting to show notification:", {
      title,
      body,
      tag,
      permission: Notification.permission,
      visibilityState: document.visibilityState,
      hasFocus: isFocused,
    });

    const options: NotificationOptions = {
      body,
      icon: "/logo/logo.png",
      tag,
      badge: "/logo/logo.png",
      data: { url },
    };

    const createNotification = () => {
      try {
        const notification = new Notification(title, options);
        console.log("[Notifications] In-page notification created successfully");
        notification.onclick = () => {
          try {
            window.focus();
            window.location.href = url;
            notification.close();
          } catch (clickErr: any) {
            console.error("[Notifications] Notification click handler error:", clickErr?.message || clickErr);
          }
        };
      } catch (e: any) {
        console.error("[Notifications] Failed to create in-page notification:", e?.message || e);
      }
    };

    const createServiceWorkerNotification = async () => {
      if (!("serviceWorker" in navigator)) {
        console.log("[Notifications] ServiceWorker API not available, falling back to in-page notification");
        createNotification();
        return;
      }

      let registration: ServiceWorkerRegistration | undefined;
      try {
        registration = await navigator.serviceWorker.getRegistration();
      } catch (e: any) {
        console.warn("[Notifications] getRegistration() threw - using in-page fallback:", e?.message || e);
        createNotification();
        return;
      }

      if (!registration) {
        console.log("[Notifications] No active SW registration (may still be registering). Using in-page notification.");
        createNotification();
        return;
      }

      const preferSW = !isVisible || !isFocused;
      if (preferSW) {
        try {
          console.log(
            "[Notifications] Using SW notification (page:",
            isVisible ? "visible" : "hidden",
            "| window:",
            isFocused ? "focused" : "not focused",
            ")",
          );
          await registration.showNotification(title, options);
          console.log("[Notifications] SW notification shown successfully");
          return;
        } catch (e: any) {
          console.warn("[Notifications] SW notification failed, falling back to in-page:", e?.message || e);
        }
      } else {
        console.log("[Notifications] Window is focused. Using in-page notification.");
      }

      createNotification();
    };

    if (Notification.permission === "granted") {
      void createServiceWorkerNotification();
    } else if (Notification.permission === "denied") {
      console.warn(
        "[Notifications] Permission is DENIED by user. Cannot show notification.",
        "Instruct user to unblock notifications: click 🔒 in address bar → Site settings → Notifications → Allow",
      );
    } else {
      console.warn(
        "[Notifications] Permission state is 'default' (not yet requested). Skipping notification.",
        "User MUST grant permission via the 'Allow Notifications' button in Settings → Notifications (requires a user click gesture).",
      );
    }
  }, [preferences.enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const unlockAudio = () => {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const context = audioContextRef.current;
      if (context?.state === "suspended") {
        context.resume().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, []);

  return {
    preferences,
    showNotification,
    requestPermission,
    playRingtone,
    updatePreferences,
  };
}
