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
  if (requestedUserId === null) {
    notificationPreferencesUserId = null;
    notificationPreferencesLoaded = true;
    notificationPreferencesPromise = null;
    notificationPreferencesPromiseUserId = null;
    return publishNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
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
    publishNotificationPreferences(DEFAULT_NOTIFICATION_PREFERENCES);
  }

  notificationPreferencesPromiseUserId = requestedUserId;
  const requestHolder: {
    promise?: Promise<NotificationPreferences>;
  } = {};
  const request = (async () => {
    try {
      const res = await cachedFetch("/api/settings", {
        credentials: "include",
        cache: "no-store",
        ttlMs: ApiCacheTTL.long,
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
  /*
   * Short two-note alert: a lower note immediately swallowed by an upper one,
   * both decaying like a struck bell. This is deliberately ONE phrase of about
   * half a second — a message alert, not a ringtone (see RINGTONE_REPEATS).
   */
  whatsapp: [
    { start: 0, duration: 0.16, freq: 1174.66, type: "sine", volume: 0.3 },
    { start: 0.11, duration: 0.42, freq: 1567.98, type: "sine", volume: 0.26 },
  ],
  bell: [
    { start: 0, duration: 0.35, freq: 880, type: "triangle", volume: 0.2 },
    { start: 0.04, duration: 0.3, freq: 1318, type: "triangle", volume: 0.15 },
    { start: 0.08, duration: 0.25, freq: 1760, type: "triangle", volume: 0.1 },
  ],
  none: [],
};

/**
 * Message alerts are heard once. Anything longer belongs on an incoming call.
 */
const RINGTONE_REPEATS: Record<string, number> = {
  whatsapp: 1,
};

/** Gap between phrase repetitions, for the ringtones that do repeat. */
const RINGTONE_REPEAT_GAP = 0.18;

/** Gain ramp used to fade a note in; without it every tone starts with a click. */
const RINGTONE_ATTACK_SECONDS = 0.008;

/**
 * How long the launch tune waits for the audio context to resume before giving
 * up. A cold start that is going to be allowed resumes almost instantly.
 */
const STARTUP_TUNE_RESUME_MS = 400;

/** Level of the octave harmonic that makes the tone bell-like instead of beepy. */
const RINGTONE_HARMONIC_LEVEL = 0.22;

/**
 * How long a raised notification stays on screen. Long enough to be noticed
 * and tapped, short enough to behave like a chat app rather than a nag.
 */
const NOTIFICATION_VISIBLE_MS = 8000;

/** Android double-buzz, matching the two-note alert. */
const NOTIFICATION_VIBRATION: VibratePattern = [0, 200, 100, 200];

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
};

/** Typed access to the (prefixed) AudioContext constructor. */
const getAudioContextCtor = (): (new () => AudioContext) | null => {
  if (typeof window === "undefined") return null;
  const audioWindow = window as typeof window & {
    AudioContext?: new () => AudioContext;
    webkitAudioContext?: new () => AudioContext;
  };
  return audioWindow.AudioContext || audioWindow.webkitAudioContext || null;
};

export function useNotifications(userId?: string | number) {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    notificationPreferencesSnapshot,
  );
  const [preferencesLoaded, setPreferencesLoaded] = useState(
    notificationPreferencesLoaded,
  );
  /**
   * True once this device has a stored Web Push subscription. The notification
   * surface uses it to decide whether a hidden app can stand down: when push is
   * live the backend will reach the device over the internet anyway, so raising
   * a second, socket-driven notification would alert the user twice. Without a
   * subscription there is nothing to fall back on, so the in-app alert stays.
   */
  const [pushReady, setPushReady] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const customAudioStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const autoCloseTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  /**
   * Schedules the auto-dismiss of a raised notification. Keyed by notification
   * tag so a newer message replacing the one already in the tray restarts the
   * countdown instead of having the old timer close the new notification early.
   */
  const scheduleAutoClose = useCallback((key: string, close: () => void) => {
    const previous = autoCloseTimersRef.current.get(key);
    if (previous) clearTimeout(previous);
    autoCloseTimersRef.current.set(
      key,
      setTimeout(() => {
        autoCloseTimersRef.current.delete(key);
        close();
      }, NOTIFICATION_VISIBLE_MS),
    );
  }, []);

  useEffect(
    () => () => {
      autoCloseTimersRef.current.forEach((timer) => clearTimeout(timer));
      autoCloseTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const unsubscribe = subscribeToNotificationPreferences(setPreferences);
    void loadNotificationPreferences(userId).then((loaded) => {
      setPreferences(loaded);
      setPreferencesLoaded(true);
    });
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
        } else {
          // Server copy changed — drop the shared cached GET so every consumer
          // (AppContext bootstrap, Settings, ChatWindow) reads the fresh values.
          invalidateApiCache("/api/settings");
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
    try {
      const result =
        Notification.permission === "default"
          ? await Notification.requestPermission()
          : Notification.permission;
      console.log("[Notifications] Notification permission result:", result);
      if (result === "granted") {
        const ready = await ensurePushSubscription();
        setPushReady(ready);
        if (!ready) {
          console.warn(
            "[Notifications] Browser permission is granted, but background push is not configured for this device.",
          );
        }
      }
    } catch (error) {
      console.error(
        "[Notifications] Notification permission or push subscription failed:",
        error instanceof Error ? error.message : error,
      );
    }
  }, []);

  const clearCustomRingtone = useCallback(() => {
    if (customAudioStopTimerRef.current) {
      clearTimeout(customAudioStopTimerRef.current);
      customAudioStopTimerRef.current = null;
    }

    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      customAudioRef.current = null;
    }
  }, []);

  const playRingtone = useCallback((ringtone: string) => {
    if (typeof window === "undefined") return;
    if (ringtone === "none") return;
    if (!preferences.enabled) return;

    clearCustomRingtone();

    const isUrl = /^https?:\/\//i.test(ringtone) || ringtone.startsWith("blob:");
    if (isUrl) {
      try {
        const audio = new Audio(ringtone);
        audio.volume = 0.35;
        customAudioRef.current = audio;
        customAudioStopTimerRef.current = setTimeout(() => {
          if (!customAudioRef.current) return;
          customAudioRef.current.pause();
          customAudioRef.current.currentTime = 0;
          customAudioRef.current = null;
          customAudioStopTimerRef.current = null;
        }, 3200);
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
      const patternDuration =
        pattern.reduce(
          (longest, note) => Math.max(longest, note.start + note.duration),
          0,
        ) || 0.5;
      const repeatCount = RINGTONE_REPEATS[ringtone] ?? 2;
      const repeatGap = RINGTONE_REPEAT_GAP;

      // One shared output so overlapping notes never clip.
      const master = ctx.createGain();
      master.gain.setValueAtTime(0.9, now);
      master.connect(ctx.destination);

      /**
       * Plays `freq` with a fast fade-in, an exponential decay and a quiet
       * octave on top. The attack removes the click at the start and the
       * harmonic gives the note a bell timbre rather than a flat beep.
       */
      const scheduleNote = (
        freq: number,
        startAt: number,
        duration: number,
        peak: number,
        type: OscillatorType,
      ) => {
        const harmonics: Array<{ ratio: number; level: number; decay: number }> = [
          { ratio: 1, level: 1, decay: 1 },
          { ratio: 2, level: RINGTONE_HARMONIC_LEVEL, decay: 0.7 },
        ];

        harmonics.forEach(({ ratio, level, decay }) => {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const attackEnd = startAt + RINGTONE_ATTACK_SECONDS;
          const releaseAt = startAt + duration * decay;

          oscillator.type = type;
          oscillator.frequency.setValueAtTime(freq * ratio, startAt);

          gain.gain.setValueAtTime(0.0001, startAt);
          gain.gain.linearRampToValueAtTime(peak * level, attackEnd);
          gain.gain.exponentialRampToValueAtTime(0.0001, releaseAt);

          oscillator.connect(gain);
          gain.connect(master);
          oscillator.start(startAt);
          oscillator.stop(releaseAt + 0.03);
        });
      };

      for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex += 1) {
        const offset = repeatIndex * (patternDuration + repeatGap);
        pattern.forEach((note) => {
          scheduleNote(
            note.freq,
            now + offset + note.start,
            note.duration,
            note.volume ?? 0.12,
            note.type || "sine",
          );
        });
      }
    } catch (e: any) {
      console.warn("[Notifications] Ringtone generation failed:", e?.message || e);
    }
  }, [clearCustomRingtone, preferences.enabled]);

  /**
   * Launch tune, played once when the installed app is opened from the home
   * screen. Launching a PWA counts as a user action, so the context normally
   * resumes straight away — this uses the same tone as a message alert so the
   * app sounds like itself the moment it opens.
   *
   * If the context stays suspended (a plain browser tab, or a strict autoplay
   * policy) the tune is dropped rather than deferred: a startup sound arriving
   * later, on the user's first tap, would be far stranger than silence.
   */
  const playStartupTune = useCallback(
    async (ringtone: string) => {
      if (typeof window === "undefined") return;
      if (!preferences.enabled || ringtone === "none") return;

      const AudioCtx = getAudioContextCtor();
      if (!AudioCtx) return;

      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const context = audioContextRef.current;
      if (!context) return;

      if (context.state === "suspended") {
        await Promise.race([
          context.resume().catch(() => {}),
          new Promise<void>((resolve) => {
            setTimeout(() => resolve(), STARTUP_TUNE_RESUME_MS);
          }),
        ]);
      }

      if (context.state !== "running") return;

      playRingtone(ringtone);
    },
    [playRingtone, preferences.enabled],
  );

  /**
   * `silent` suppresses the platform sound and vibration. The caller sets it
   * when the in-app tone has already played, so the user hears one alert
   * instead of the tone and the system sound on top of each other.
   */
  const showNotification = useCallback((title: string, body: string, tag?: string, url = "/chat", silent = false, image?: string) => {
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

    /*
     * `renotify` is honoured by browsers but missing from some TypeScript DOM
     * lib versions, hence the assertion on the finished object.
     */
    const options = {
      body,
      // Photos and videos are previewed straight in the notification, like
      // WhatsApp; everything else falls back to the app icon.
      icon: image || "/logo/logo.png",
      image,
      tag,
      badge: "/logo/logo.png",
      data: { url },
      /*
       * Chat-app alert behaviour: keep the platform sound on, buzz twice on
       * Android, and re-alert even when this replaces a notification for the
       * same chat that is still sitting in the tray.
       */
      silent,
      renotify: true,
      vibrate: silent ? undefined : NOTIFICATION_VIBRATION,
      timestamp: Date.now(),
    } as NotificationOptions;

    const autoCloseKey = tag || `${title}:${body}`;

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
        scheduleAutoClose(autoCloseKey, () => notification.close());
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
          scheduleAutoClose(autoCloseKey, () => {
            void registration
              .getNotifications({ tag })
              .then((notifications) =>
                notifications.forEach((notificationInstance) =>
                  notificationInstance.close(),
                ),
              )
              .catch((closeError: any) => {
                console.warn(
                  "[Notifications] Could not auto-close SW notification:",
                  closeError?.message || closeError,
                );
              });
          });
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
        "The in-app 'Turn on notifications' prompt asks for it on the user's next click.",
      );
    }
  }, [preferences.enabled, scheduleAutoClose]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    /**
     * Browsers block audio until a user gesture, and mobile browsers re-suspend
     * the context whenever the tab goes to the background. So instead of
     * unlocking once, keep these handlers attached and cheaply resume the
     * context whenever needed — otherwise the alert silently does not play.
     */
    const unlockAudio = () => {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) audioContextRef.current = new AudioCtx();
      const context = audioContextRef.current;
      if (context?.state === "suspended") {
        context.resume().catch(() => {});
      }
    };

    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio);
    window.addEventListener("touchstart", unlockAudio, { passive: true });
    window.addEventListener("focus", unlockAudio);
    document.addEventListener("visibilitychange", unlockAudio);
    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
      window.removeEventListener("focus", unlockAudio);
      document.removeEventListener("visibilitychange", unlockAudio);
    };
  }, []);

  /*
   * Keeps the Web Push registration in step with the permission, no matter
   * which screen granted it (the in-app prompt or Settings). Re-checked
   * whenever the user comes back to the app, so turning notifications on
   * anywhere ends with a subscribed device.
   */
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const syncPushSubscription = () => {
      if (Notification.permission !== "granted") {
        setPushReady(false);
        return;
      }
      void ensurePushSubscription().then(setPushReady);
    };

    syncPushSubscription();
    document.addEventListener("visibilitychange", syncPushSubscription);
    window.addEventListener("focus", syncPushSubscription);
    return () => {
      document.removeEventListener("visibilitychange", syncPushSubscription);
      window.removeEventListener("focus", syncPushSubscription);
    };
  }, []);

  useEffect(() => clearCustomRingtone, [clearCustomRingtone]);

  return {
    preferences,
    preferencesLoaded,
    pushReady,
    showNotification,
    requestPermission,
    playRingtone,
    playStartupTune,
    updatePreferences,
  };
}
