"use client";

import { useState } from "react";

export const useNotificationSettings = (notifications: any, setNotifications: any) => {
  const [loading, setLoading] = useState(false);

  const saveNotifications = async (updated: any) => {
    setLoading(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notifications: updated }),
      });
    } catch {
      // Ignore update failure; maintain app stability without console output.
    }
    setLoading(false);
  };

  const toggleNotification = async (key: "messages" | "groups" | "enabled") => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    await saveNotifications(updated);

    if (key === "enabled" && updated.enabled && typeof window !== "undefined" && "Notification" in window) {
      Notification.requestPermission().catch(() => {});
    }
  };

  const setRingtone = async (ringtone: string) => {
    const updated = { ...notifications, ringtone };
    setNotifications(updated);
    await saveNotifications(updated);
  };

  return { toggleNotification, setRingtone, loading };
};
