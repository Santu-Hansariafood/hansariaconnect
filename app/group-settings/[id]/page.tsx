"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import Loading from "@/components/common/Loading/Loading";

const GroupSettings = dynamic(
  () => import("@/components/pages/Groups/[id]/GroupSettings"),
  { loading: () => <Loading /> }
);

export default function GroupSettingsPage() {
  const router = useRouter();
  const { user, theme } = useApp() as {
    user: { step?: string } | null;
    theme: { primary: string; wallpaper: string; textSize: string } | null;
  };

  useEffect(() => {
    if (!user || user.step !== "complete") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) return null;

  const safeTheme =
    theme || ({
      primary: "#0CA678",
      wallpaper: "bg-gradient-to-br from-emerald-50 to-teal-50",
      textSize: "text-base",
    } as const);

  return <GroupSettings user={user as any} theme={safeTheme} />;
}


