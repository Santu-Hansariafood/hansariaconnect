"use client";
import { MessageCircle, Users, Image as ImageIcon, Settings, Phone } from "lucide-react";

export function useNavbarItems(unreadCounts: { chats: number; groups: number }) {
  return [
    { path: "/chats", icon: MessageCircle, label: "Chats", count: unreadCounts.chats },
    { path: "/contacts", icon: Phone, label: "Contacts", count: 0 },
    { path: "/status", icon: ImageIcon, label: "Status", count: 0 },
    { path: "/groups", icon: Users, label: "Groups", count: unreadCounts.groups },
    { path: "/settings", icon: Settings, label: "Settings", count: 0 },
  ];
}
