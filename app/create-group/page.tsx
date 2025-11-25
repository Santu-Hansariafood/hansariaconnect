"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import Loading from "@/components/common/Loading/Loading";

const CreateGroup = dynamic(() => import("@/components/pages/CreateGroup/CreateGroup"), {
  loading: () => <Loading />,
});

export default function CreateGroupPage() {
  const router = useRouter();
  const { user, theme } = useApp() as {
    user: { step?: string } | null;
    theme: { primary: string; textSize: string; wallpaper: string } | null;
  };

  useEffect(() => {
    if (!user || user.step !== "complete") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user) return null;

  const safeTheme =
    theme || ({
      primary: "#10B981",
      textSize: "text-base",
      wallpaper: "bg-gray-50",
    } as const);

  return <CreateGroup user={user} theme={safeTheme} />;
}
