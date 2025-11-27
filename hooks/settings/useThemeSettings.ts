"use client";

import { useState } from "react";

export const useThemeSettings = (initialTheme: any, onThemeChange: any) => {
  const [localTheme, setLocalTheme] = useState(initialTheme);
  const [loading, setLoading] = useState(false);

  const saveTheme = async (updatedTheme: any) => {
    setLoading(true);
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ theme: updatedTheme }),
      });
    } catch {
      console.log("Theme save failed");
    }
    setLoading(false);
  };

  const updateTheme = (changes: any) => {
    const updated = { ...localTheme, ...changes };
    setLocalTheme(updated);
    onThemeChange(updated);
    saveTheme(updated);
  };

  return { localTheme, updateTheme, loading };
};
