"use client";

import { useState } from "react";

export const useNotificationSettings = (notifications: any, setNotifications: any) => {
  const [loading, setLoading] = useState(false);

  const toggleNotification = async (key: "messages" | "groups" | "enabled") => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);

    setLoading(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notifications: updated }),
      });
    } catch {
      console.log("Notification update failed");
    }
    setLoading(false);
  };

  return { toggleNotification, loading };
};
