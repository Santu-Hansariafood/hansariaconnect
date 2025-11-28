"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Loading from "@/components/common/Loading/Loading";
import ChatHome from "@/components/pages/ChatHome/ChatHome";

interface User {
  name: string;
  step?: string;
  photo?: string;
  email?: string;
  id?: string;
  [key: string]: any;
}

interface Theme {
  primary: string;
  secondary: string;
  wallpaper: string;
  textSize: string;
}

export default function ChatPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [theme, setTheme] = useState<Theme>({
    primary: "#0CA678",
    secondary: "#A2F5BF",
    wallpaper: "bg-gradient-to-br from-emerald-50 to-teal-50",
    textSize: "text-base",
  });

  useEffect(() => {
    const savedUser = localStorage.getItem("hansariaUser");
    const savedTheme = localStorage.getItem("hansariaTheme");

    if (!savedUser) {
      router.replace("/login");
      return;
    }

    const parsedUser: User = JSON.parse(savedUser);
    setUser(parsedUser);

    if (savedTheme) {
      setTheme(JSON.parse(savedTheme));
    }

    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("hansariaUser");
    setUser(null);
    router.replace("/login");
  };

  if (loading) {
    return (
      <Loading />
    );
  }

  if (!user) {
    return (
      <Loading />
    );
  }

  return <ChatHome user={user} theme={theme} onLogout={handleLogout} />;
}
