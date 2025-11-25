"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import dynamic from "next/dynamic";

// ----------------------
// Correct User Type
// ----------------------
interface UserType {
  id?: string;
  name?: string;
  photo?: string;
  mobile: string;      // ✅ REQUIRED for NameEntry
  step: "name" | "complete" | string;
  [key: string]: any;
}

// Props expected by NameEntry component
interface NameEntryProps {
  user: UserType;
  onComplete: (name: string, photo: string) => void;
}

// ----------------------
// Dynamic Import — WITHOUT generics
// (Next.js 16 does not need <NameEntryProps>)
// ----------------------
const NameEntry = dynamic(
  () => import("@/components/pages/NameEntry/NameEntry"),
  { ssr: false }
);

export default function NameEntryPage() {
  const { user, setUser } = useApp() as {
    user: UserType | null;
    setUser: (u: UserType) => void;
  };

  const router = useRouter();

  // Redirect only in effect
  useEffect(() => {
    if (!user || user.step !== "name") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || user.step !== "name") return null;

  // Handle name entry
  const handleNameEntry = (name: string, photo: string) => {
    const updated: UserType = {
      ...user,
      name,
      photo,
      step: "complete",
    };

    setUser(updated);
    localStorage.setItem("hansariaUser", JSON.stringify(updated));
    router.push("/status");
  };

  return <NameEntry user={user} onComplete={handleNameEntry} />;
}
