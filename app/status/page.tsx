"use client";

import Loading from "@/components/common/Loading/Loading";
import { useApp } from "@/context/AppContext/AppContext";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
const StatusPage = dynamic(() => import("@/components/pages/Status/Status"), {
  loading: () => <Loading />,
});

export default function StatusRoute() {
  const { user, theme } = useApp();
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!user || user.step !== "complete") {
      router.replace("/");
    }
  }, [hydrated, user, router]);

  if (!hydrated) return null;

  if (!user) return null;

  return <StatusPage user={user} theme={theme} />;
}
