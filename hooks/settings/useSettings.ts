"use client";

import { useEffect, useState } from "react";

export const useSettings = () => {
  const [initialTheme, setInitialTheme] = useState<any>(null);
  const [notifications, setNotifications] = useState({
    messages: true,
    groups: true,
    enabled: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings",{
          credentials: "include",
        });
        const data = await res.json();

        if (res.ok) {
          if (data.theme) setInitialTheme(data.theme);
          if (data.notifications) setNotifications(data.notifications);
        }
      } catch (err) {
        console.log("Settings load failed", err);
      }
    };

    loadSettings();
  }, []);

  return { initialTheme, notifications, setNotifications };
};
