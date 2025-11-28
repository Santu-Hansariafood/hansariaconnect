import { useEffect, useState } from "react";

interface NotificationPreferences {
  messages: boolean;
  groups: boolean;
  enabled: boolean;
}

export function useNotifications() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    messages: true,
    groups: true,
    enabled: true,
  });

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await fetch("/api/settings",{
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

  const showNotification = (title: string, body: string, tag?: string) => {
    if (!preferences.enabled) return;
    if (!("Notification" in window)) return;

    if (Notification.permission === "granted") {
      new Notification(title, {
        body,
        icon: "/logo/logo.png",
        tag,
        badge: "/logo/logo.png",
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, {
            body,
            icon: "/logo/logo.png",
            tag,
            badge: "/logo/logo.png",
          });
        }
      });
    }
  };

  return { preferences, showNotification };
}

