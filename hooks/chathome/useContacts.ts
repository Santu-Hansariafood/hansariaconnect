"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

const CATCHUP_COOLDOWN_MS = 120_000;

export const useContacts = (userId?: string | number) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedConversations = useRef(false);
  const lastCatchupAtRef = useRef(0);
  const { onlineUserIds, socket, addListener, removeListener } = useSocket();
  const { bootstrapData } = useApp();

  const mergeSavedContacts = useCallback((savedContacts: any[]) => {
    const saved = savedContacts.map((contact: any): Contact => {
      const registeredUserId = String(contact?.registeredUserId || "");
      const contactId = String(contact?._id || contact?.id || registeredUserId);
      const mobiles = Array.isArray(contact?.mobiles)
        ? contact.mobiles.filter(Boolean).map(String)
        : [];
      const displayName =
        contact?.registeredProfile?.name || contact?.name || mobiles[0] || "Unknown";

      return {
        id: contactId,
        peerId: registeredUserId || undefined,
        name: displayName,
        mobile: mobiles[0] || contact?.mobile || "",
        avatar: contact?.registeredProfile?.photo || contact?.avatar || "/logo/logo.png",
        pinned: !!contact?.pinned,
        blocked: !!contact?.blocked,
        active: false,
        unread: 0,
        lastSeen: "",
        lastMessageTime: "",
        lastMessage: registeredUserId ? "Start a conversation" : "Invite to HansariaConnect",
        mobiles,
        email: contact?.email || "",
        registered: !!registeredUserId,
        registeredUserId: registeredUserId || undefined,
      };
    });

    setContacts((previous) => {
      const byKey = new Map<string, Contact>();
      previous.forEach((contact) => {
        byKey.set(contact.registeredUserId || contact.peerId || contact.id, contact);
      });
      saved.forEach((contact) => {
        const key = contact.registeredUserId || contact.id;
        const existing = byKey.get(key);
        byKey.set(key, existing ? { ...contact, ...existing } : contact);
      });
      return Array.from(byKey.values());
    });
  }, []);

  const loadSavedContacts = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`/api/contacts?userId=${encodeURIComponent(String(userId))}`, {
        credentials: "include",
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok && Array.isArray(data?.contacts)) {
        mergeSavedContacts(data.contacts);
      } else {
        console.warn(
          "[useContacts] loadSavedContacts HTTP",
          response.status,
          "-",
          data?.error || "no data",
        );
      }
    } catch (err: any) {
      console.error(
        "[useContacts] loadSavedContacts network error:",
        err?.message || err,
      );
    }
  }, [mergeSavedContacts, userId]);

  const loadConversations = useCallback(async () => {
    try {
      if (!hasLoadedConversations.current) setLoading(true);
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

      if (!convRes.ok) {
        console.warn(
          "[useContacts] conversations fetch HTTP",
          convRes.status,
          "-",
          convData?.error || "failed",
        );
      }
      if (!unreadRes.ok) {
        console.warn(
          "[useContacts] unread-counts fetch HTTP",
          unreadRes.status,
          "-",
          unreadData?.error || "failed",
        );
      }

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

        setContacts((previous) => {
          const conversationKeys = new Set(
            mapped.map((contact) => contact.registeredUserId || contact.peerId || contact.id),
          );
          const savedOnly = previous.filter(
            (contact) =>
              !conversationKeys.has(
                contact.registeredUserId || contact.peerId || contact.id,
              ),
          );
          return [...mapped, ...savedOnly];
        });
      }
    } catch (err: any) {
      console.error(
        "[useContacts] loadConversations error:",
        err?.message || err,
      );
    } finally {
      hasLoadedConversations.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleSocketConnect = () => {
      console.log("[useContacts] Socket connected — refreshing conversation list");
      void loadConversations();
    };
    const handleSocketReconnect = () => {
      console.log("[useContacts] Socket reconnected — refreshing conversation list");
      void loadConversations();
    };

    const handleCatchupConversation = (payload: any) => {
      const peerId = String(payload?.peerId || payload?.from || payload?.to || "");
      if (!peerId) return;
      setContacts((previous) =>
        previous.map((contact) => {
          const cp = String(
            contact.registeredUserId || contact.peerId || contact.id || "",
          );
          if (cp !== peerId) return contact;
          return {
            ...contact,
            lastMessageTime:
              payload?.createdAt || payload?.timestamp || new Date().toISOString(),
          };
        }),
      );
    };

    socket.on("connect", handleSocketConnect);
    socket.io?.on("reconnect", handleSocketReconnect);
    addListener("conversation:updated", handleCatchupConversation);

    return () => {
      socket.off("connect", handleSocketConnect);
      socket.io?.off("reconnect", handleSocketReconnect);
      removeListener("conversation:updated", handleCatchupConversation);
    };
  }, [addListener, loadConversations, removeListener, socket]);

  useEffect(() => {
    void loadSavedContacts();
  }, [loadSavedContacts]);

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

      setContacts((previous) => {
        const conversationKeys = new Set(
          mapped.map((contact) => contact.registeredUserId || contact.peerId || contact.id),
        );
        const savedOnly = previous.filter(
          (contact) =>
            !conversationKeys.has(
              contact.registeredUserId || contact.peerId || contact.id,
            ),
        );
        return [...mapped, ...savedOnly];
      });
      hasLoadedConversations.current = true;
      setLoading(false);
      return;
    }

    const catchupIfNeeded = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const now = Date.now();
      const stale = now - lastCatchupAtRef.current > CATCHUP_COOLDOWN_MS;
      if (stale || !hasLoadedConversations.current) {
        lastCatchupAtRef.current = now;
        void loadConversations();
      }
    };

    catchupIfNeeded();

    const onWindowFocus = () => catchupIfNeeded();
    const onVisibilityChange = () => catchupIfNeeded();

    window.addEventListener("focus", onWindowFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("focus", onWindowFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [bootstrapData.conversations, loadConversations]);

  useEffect(() => {
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

  const updateContact = useCallback((contactId: string, updates: Partial<Contact>) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, ...updates } : contact
      )
    );
  }, []);

  return {
    contacts,
    loading,
    setContacts,
    updateContact,
  };
};
