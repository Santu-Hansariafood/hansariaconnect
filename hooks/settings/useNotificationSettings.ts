"use client";

import { useState } from "react";

export const useNotificationSettings = (notifications: any, setNotifications: any) => {
  const [loading, setLoading] = useState(false);

  const saveNotifications = async (updated: any) => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notifications: updated }),
      });
      if (!response.ok) {
        console.error(
          "[useNotificationSettings] saveNotifications HTTP error:",
          response.status,
          response.statusText,
        );
      }
    } catch (error: any) {
      console.error(
        "[useNotificationSettings] saveNotifications network error:",
        error?.message || String(error),
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleNotification = async (key: "messages" | "groups" | "enabled") => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    await saveNotifications(updated);
  };

  const setRingtone = async (ringtone: string) => {
    const updated = { ...notifications, ringtone };
    setNotifications(updated);
    await saveNotifications(updated);
  };

  return { toggleNotification, setRingtone, loading };
};
