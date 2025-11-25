"use client";

import StatusPage from "@/components/pages/Status/Status";
import { useApp } from "@/context/AppContext/AppContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function StatusRoute() {
  const { user, theme } = useApp();
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Redirect only after hydration + user loaded
  useEffect(() => {
    if (!hydrated) return;

    if (!user || user.step !== "complete") {
      router.replace("/");
    }
  }, [hydrated, user, router]);

  // Don't render anything until hydration is complete
  if (!hydrated) return null;

  // If user data not loaded yet (localStorage), block UI flashing
  if (!user) return null;

  return <StatusPage user={user} theme={theme} />;
}
