"use client";

import { useState, useEffect, useCallback } from "react";
import { useSocket } from "../useSocket";

export interface Contact {
  id: string;
  peerId?: string;
  name: string;
  mobile: string;
  avatar: string;
  pinned: boolean;
  blocked?: boolean;
  active: boolean;
  unread: number;
  lastSeen?: string;
  lastMessageTime: string;
  lastMessage: string;
  mobiles?: string[];
  email?: string;
  registered?: boolean;
  registeredUserId?: string;
}

export const useContacts = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { onlineUserIds } = useSocket();

  useEffect(() => {
    const loadConversations = async () => {
      try {
        setLoading(true);
        const [convRes, unreadRes] = await Promise.all([
          fetch("/api/conversations", {
            method: "GET",
            credentials: "include",
          }),
          fetch("/api/unread-counts", {
            cache: "no-store",
            credentials: "include",
          }),
        ]);

        const convData = await convRes.json();
        const unreadData = await unreadRes.json();
        const unreadMap = unreadData?.conversations || {};

        if (Array.isArray(convData?.conversations)) {
          const mapped: Contact[] = convData.conversations.map((c: any) => {
            let lastMessageText = "";

            if (c.lastMessage) {
              if (c.lastMessage.type === "text") lastMessageText = c.lastMessage.text || "";
              else if (c.lastMessage.type === "image") lastMessageText = "📷 Image";
              else if (c.lastMessage.type === "video") lastMessageText = "🎥 Video";
              else if (c.lastMessage.type === "voice") lastMessageText = "🎤 Voice";
              else if (c.lastMessage.type === "pdf") lastMessageText = "📄 PDF";
              else if (c.lastMessage.type === "excel") lastMessageText = "📊 Excel";
              else if (c.lastMessage.type === "link") lastMessageText = c.lastMessage.linkTitle || "🔗 Link";
              else lastMessageText = c.lastMessage.text || "";
            }

            return {
              id: c.id || c.peerId,
              peerId: c.peerId || c.id,
              name: c.name || c.mobile || "Unknown",
              mobile: c.mobile || "",
              avatar: c.avatar || "/logo/logo.png",
              pinned: false,
              blocked: false,
              active: false,
              unread: unreadMap[c.peerId || c.id] || 0,
              lastSeen: "",
              lastMessageTime: c.lastMessageAt || "",
              lastMessage: lastMessageText,
              mobiles: [c.mobile].filter(Boolean),
              email: "",
              registered: true,
              registeredUserId: c.peerId || c.id,
            };
          });

          setContacts(mapped);
        }
      } catch {} finally {
        setLoading(false);
      }
    };

    loadConversations();
  }, []);

  // Update contacts' active status based on onlineUserIds
  useEffect(() => {
    setContacts(prev => prev.map(contact => ({
      ...contact,
      active: onlineUserIds.includes(contact.registeredUserId || contact.peerId || contact.id)
    })));
  }, [onlineUserIds]);

  const updateContact = (contactId: string, updates: Partial<Contact>) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      )
    );
  };

  return {
    contacts,
    loading,
    setContacts,
    updateContact,
  };
};
