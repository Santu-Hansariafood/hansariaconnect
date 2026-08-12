import { useEffect, useRef, useState } from "react";

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

  const requestPermission = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      try {
        await Notification.requestPermission();
      } catch {
        // ignore
      }
    }
  };

  const playRingtone = (ringtone: string) => {
    if (typeof window === "undefined") return;
    if (ringtone === "none") return;
    if (!preferences.enabled) return;

    const isUrl = /^https?:\/\//i.test(ringtone) || ringtone.startsWith("blob:");
    if (isUrl) {
      try {
        const audio = new Audio(ringtone);
        audio.volume = 0.35;
        audio.play().catch(() => {
          // ignore playback failure
        });
      } catch {
        // ignore custom audio play failure
      }
      return;
    }

    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

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
  };

  const showNotification = (title: string, body: string, tag?: string) => {
    if (!preferences.enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const createNotification = () => {
      try {
        new Notification(title, {
          body,
          icon: "/logo/logo.png",
          tag,
          badge: "/logo/logo.png",
        });
      } catch {
        // Ignore notification creation failure
      }
    };

    if (Notification.permission === "granted") {
      createNotification();
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          createNotification();
        }
      }).catch(() => {
        // ignore permission request failure
      });
    }
  };

  return { preferences, showNotification, requestPermission, playRingtone };
}

