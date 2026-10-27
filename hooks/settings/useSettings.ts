"use client";

import { useEffect, useState } from "react";
import { ApiCacheTTL, cachedFetch } from "@/lib/api/clientCache";

export const useSettings = () => {
  const [initialTheme, setInitialTheme] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Shared with AppContext / notifications, so settings load once.
        const res = await cachedFetch("/api/settings", {
          credentials: "include",
          ttlMs: ApiCacheTTL.long,
        });
        const data = await res.json();

        if (res.ok) {
          if (data.theme) setInitialTheme(data.theme);
        }
      } catch (err) {
        console.log("Settings load failed", err);
      }
    };

    loadSettings();
  }, []);

  return { initialTheme };
};
