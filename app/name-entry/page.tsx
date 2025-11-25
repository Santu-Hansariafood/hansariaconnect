"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import dynamic from "next/dynamic";

interface UserType {
  id?: string;
  name?: string;
  photo?: string;
  mobile: string;
  step: "name" | "complete" | string;
  [key: string]: any;
}

interface NameEntryProps {
  user: UserType;
  onComplete: (name: string, photo: string) => void;
}

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
  useEffect(() => {
    if (!user || user.step !== "name") {
      router.replace("/");
    }
  }, [user, router]);

  if (!user || user.step !== "name") return null;

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
