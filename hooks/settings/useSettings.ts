"use client";

import { useEffect, useState } from "react";

export const useSettings = () => {
  const [initialTheme, setInitialTheme] = useState<any>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch("/api/settings",{
          credentials: "include",
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
