"use client";
import { useEffect, useState } from "react";
import { MessageCircle, Users, Image as ImageIcon, Settings, Phone } from "lucide-react";

export function useNavbarItems(unreadCounts: { chats: number; groups: number }) {
  const [allowed, setAllowed] = useState<{ contacts: boolean; groups: boolean; status: boolean }>({
    contacts: true,
    groups: false,
    status: false,
  });
  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const res = await fetch("/api/access/me", { cache: "no-store" });
        const data = await res.json();
        if (!mounted) return;
        if (res.ok && data?.permissions) {
          setAllowed({
            contacts: !!data.permissions.contacts,
            groups: !!data.permissions.groups,
            status: !!data.permissions.status,
          });
        }
      } catch {}
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  const items = [
    { path: "/chats", icon: MessageCircle, label: "Chats", count: unreadCounts.chats },
    { path: "/contacts", icon: Phone, label: "Contacts", count: 0 },
    { path: "/status", icon: ImageIcon, label: "Status", count: 0 },
    { path: "/groups", icon: Users, label: "Groups", count: unreadCounts.groups },
    { path: "/settings", icon: Settings, label: "Settings", count: 0 },
  ];
  return items.filter((i) => {
    if (i.path === "/groups" && !allowed.groups) return false;
    if (i.path === "/status" && !allowed.status) return false;
    if (i.path === "/contacts" && !allowed.contacts) return false;
    return true;
  });
}
