"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import dynamic from "next/dynamic";

// Types
interface UserType {
  id: string;
  name: string;
  step: string;
  [key: string]: any;
}

interface ThemeType {
  primary: string;
  secondary: string;
  wallpaper: string;
  textSize: string;
}

// Dynamic import with fallback UI
const Groups = dynamic(() => import("@/components/pages/Groups/Groups"), {
  loading: () => <p className="text-center p-4">Loading...</p>,
});

export default function GroupsPage() {
  const { user, theme } = useApp() as {
    user: UserType | null;
    theme: ThemeType | null;
  };

  const router = useRouter();

  useEffect(() => {
    if (!user || user.step !== "complete") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) return null;

  // ✅ FIX: Provide safe default theme so it's never null
  const safeTheme: ThemeType = theme ?? {
    primary: "#0A0A0A",
    secondary: "#FFFFFF",
    wallpaper: "",
    textSize: "medium",
  };

  return <Groups user={user} theme={safeTheme} />;
}
