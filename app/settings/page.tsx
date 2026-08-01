"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import dynamic from "next/dynamic";

const Settings = dynamic(() => import("@/components/common/Settings/Settings"), {
  ssr: false,
});

interface User {
  name: string;
  mobile: string;
  photo: string;
  step?: string;
  [key: string]: any;
}

interface Theme {
  primary: string;
  secondary: string;
  wallpaper: string;  wallpaperImage?: string;  textSize: string;
}

export default function SettingsPage() {
  const { user, theme, updateTheme, logout } = useApp();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  useEffect(() => {
    if (!user || user.step !== "complete") {
      router.push("/");
    }
  }, [user, router]);

  if (!user) return null;

  return (
    <Settings
      user={user as User}
      theme={theme}
      onThemeChange={updateTheme}
      onLogout={handleLogout}
    />
  );
}
