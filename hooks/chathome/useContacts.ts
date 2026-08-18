"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext/AppContext";
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
  const { bootstrapData } = useApp();

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      const [convRes, unreadRes] = await Promise.all([
        fetch("/api/conversations", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
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

          const displayName = c.name || c.mobile || "Unknown";

          return {
            id: c.id || c.peerId,
            peerId: c.peerId || c.id,
            name: displayName,
            mobile: c.mobile || "",
            avatar: c.avatar || "/logo/logo.png",
            pinned: c.pinned || false,
            blocked: c.blocked || false,
            active: false,
            unread: unreadMap[c.peerId || c.id] || 0,
            lastSeen: "",
            lastMessageTime: c.lastMessageAt || "",
            lastMessage: lastMessageText,
            mobiles: [c.mobile].filter(Boolean),
            email: c.email || "",
            registered: c.registered || false,
            registeredUserId: c.peerId || c.id,
          };
        });

        setContacts(mapped);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(bootstrapData.conversations) && bootstrapData.conversations.length > 0) {
      const mapped: Contact[] = bootstrapData.conversations.map((c: any) => {
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

        const displayName = c.name || c.mobile || "Unknown";

        return {
          id: c.id || c.peerId,
          peerId: c.peerId || c.id,
          name: displayName,
          mobile: c.mobile || "",
          avatar: c.avatar || "/logo/logo.png",
          pinned: c.pinned || false,
          blocked: c.blocked || false,
          active: false,
          unread: c.unread || 0,
          lastSeen: "",
          lastMessageTime: c.lastMessageAt || "",
          lastMessage: lastMessageText,
          mobiles: [c.mobile].filter(Boolean),
          email: c.email || "",
          registered: c.registered || false,
          registeredUserId: c.peerId || c.id,
        };
      });

      setContacts(mapped);
      setLoading(false);
      return;
    }

    const refreshIfVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void loadConversations();
      }
    };

    refreshIfVisible();

    const interval = window.setInterval(refreshIfVisible, 10000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [bootstrapData.conversations, loadConversations]);

  // Only update active status for changed users, not all contacts
  useEffect(() => {
    if (onlineUserIds.length === 0) return;
    
    setContacts(prev => {
      const needsUpdate = prev.some(contact => {
        const peerId = contact.registeredUserId || contact.peerId || contact.id;
        const newActive = onlineUserIds.includes(peerId);
        return newActive !== contact.active;
      });

      if (!needsUpdate) return prev;

      return prev.map(contact => {
        const peerId = contact.registeredUserId || contact.peerId || contact.id;
        const newActive = onlineUserIds.includes(peerId);
        if (newActive === contact.active) return contact;
        return { ...contact, active: newActive };
      });
    });
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
