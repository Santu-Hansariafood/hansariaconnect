import { useCallback, useEffect, useRef, useState } from "react";

interface NotificationPreferences {
  messages: boolean;
  groups: boolean;
  enabled: boolean;
  ringtone: string;
}

const ringtonePatterns: Record<
  string,
  Array<{ start: number; duration: number; freq: number; type?: OscillatorType; volume?: number }>
> = {
  chime: [
    { start: 0, duration: 0.12, freq: 880, type: "triangle", volume: 0.12 },
    { start: 0.18, duration: 0.14, freq: 660, type: "triangle", volume: 0.1 },
  ],
  pulse: [
    { start: 0, duration: 0.08, freq: 780, type: "square", volume: 0.15 },
    { start: 0.12, duration: 0.08, freq: 780, type: "square", volume: 0.15 },
  ],
  spark: [
    { start: 0, duration: 0.06, freq: 1320, type: "sine", volume: 0.1 },
    { start: 0.08, duration: 0.1, freq: 990, type: "sine", volume: 0.08 },
  ],
  none: [],
};

const getAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
};

export function useNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    messages: true,
    groups: true,
    enabled: true,
    ringtone: "chime",
  });
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await fetch("/api/settings", {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok && data?.notifications) {
          setPreferences(data.notifications);
        }
      } catch {}
    };
    loadPreferences();
  }, []);

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

    console.log("[Notifications] Attempting to show notification:", { title, body, tag, permission: Notification.permission });

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
          window.focus();
          window.location.href = url;
          notification.close();
        };
      } catch (e: any) {
        console.error("[Notifications] Failed to create notification:", e?.message || e);
      }
    };

    const createServiceWorkerNotification = async () => {
      if (!("serviceWorker" in navigator)) {
        console.log("[Notifications] ServiceWorker not available, using in-page notification");
        createNotification();
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          if (document.visibilityState === "hidden") {
            console.log("[Notifications] Tab is hidden, using SW notification");
            await registration.showNotification(title, options);
            console.log("[Notifications] SW notification shown successfully");
            return;
          } else {
            console.log("[Notifications] Tab is visible, using in-page notification");
          }
        } else {
          console.log("[Notifications] No SW registration found, using in-page notification");
        }
      } catch (e: any) {
        console.warn("[Notifications] SW notification failed, falling back:", e?.message || e);
      }

      createNotification();
    };

    if (Notification.permission === "granted") {
      void createServiceWorkerNotification();
    } else if (Notification.permission === "denied") {
      console.warn("[Notifications] Permission denied by user - cannot show notification");
    } else {
      console.warn("[Notifications] Permission not granted (state: default) - skipping notification. User must grant permission first via a click action.");
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

  return { preferences, showNotification, requestPermission, playRingtone };
}

