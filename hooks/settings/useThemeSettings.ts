"use client";

import { useState } from "react";
import type { Theme } from "@/components/pages/ChatWindow/ChatWindowTypes";

export const useThemeSettings = (
  initialTheme: Theme | null,
  onThemeChange: (theme: Theme) => void,
) => {
  const [localTheme, setLocalTheme] = useState<Theme | null>(initialTheme);
  const [loading, setLoading] = useState(false);

  const saveTheme = async (updatedTheme: Theme) => {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: updatedTheme }),
      });
      if (!response.ok) throw new Error("Unable to save theme");
    } catch {
      console.log("Theme save failed");
    }
    setLoading(false);
  };

  const updateTheme = (changes: Partial<Theme>) => {
    const updated = { ...(localTheme || initialTheme || {}), ...changes } as Theme;
    setLocalTheme(updated);
    onThemeChange(updated);
    saveTheme(updated);
  };

  return { localTheme, updateTheme, loading };
};
