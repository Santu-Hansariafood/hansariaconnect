"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useSocket } from "@/hooks/useSocket";

const getId = (value: unknown) => String(value ?? "");

type NotifyPayload = {
  kind: "direct" | "group";
  chatId: string;
  chatName: string;
  chatAvatar?: string;
  fromUserId: string;
  fromName: string;
  fromAvatar?: string;
  preview: string;
  messageType: string;
  timestamp?: string | Date;
};

const buildUrlFromPayload = (p: NotifyPayload) =>
  p.kind === "direct" ? `/chat/${p.chatId}` : `/chat/${p.chatId}?group=true`;

export default function NotificationManager() {
  const { user } = useApp();
  const pathname = usePathname();
  const { addListener, removeListener } = useSocket();
  const { preferences, playRingtone, showNotification, requestPermission } =
    useNotifications();
  const activeChatId = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname?.startsWith("/chat/")) {
      activeChatId.current = null;
      return;
    }
    const id = pathname.replace(/^\/chat\//, "").split("?")[0];
    activeChatId.current = id || null;
  }, [pathname]);

  useEffect(() => {
    if (!user || !preferences.enabled) return;

    const currentUserId = getId(user.id);

    const handleDirectMessage = (message: any) => {
      if (!preferences.messages) return;
      if (getId(message?.from) === currentUserId) return;
      const senderId = getId(message?.from ?? message?.senderId);
      const isActiveChat = activeChatId.current === senderId;

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          message?.senderName || message?.fromName || "New message",
          message?.text || "You have a new chat message",
          `message-${getId(message?.id || message?._id || Date.now())}`,
          `/chat/${senderId}`,
        );
      }
    };

    const handleGroupMessage = (message: any) => {
      if (!preferences.groups) return;
      if (getId(message?.from) === currentUserId) return;
      const groupId = getId(message?.groupId);
      const isActiveChat = activeChatId.current === groupId;

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          message?.groupName || "New group message",
          message?.text || "You have a new group message",
          `group-${getId(message?.id || message?._id || Date.now())}`,
          `/chat/${groupId}?group=true`,
        );
      }
    };

    const handleNotify = (payload: NotifyPayload) => {
      if (!payload || typeof payload !== "object") return;
      if (payload.fromUserId === currentUserId) return;

      const kindOk =
        payload.kind === "direct" ? preferences.messages : preferences.groups;
      if (!kindOk) return;

      const isActiveChat =
        activeChatId.current && activeChatId.current === payload.chatId;

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          payload.chatName ||
            (payload.kind === "direct" ? "New message" : "New group message"),
          payload.preview || "You have a new message",
          `${payload.kind}-${payload.chatId}-${Date.now()}`,
          buildUrlFromPayload(payload),
        );
      }
    };

    addListener("message:new", handleDirectMessage);
    addListener("group:message:new", handleGroupMessage);
    addListener("message:notify", handleNotify);

    return () => {
      removeListener("message:new", handleDirectMessage);
      removeListener("group:message:new", handleGroupMessage);
      removeListener("message:notify", handleNotify);
    };
  }, [
    addListener,
    preferences.enabled,
    preferences.groups,
    preferences.messages,
    preferences.ringtone,
    playRingtone,
    removeListener,
    showNotification,
    user,
  ]);

  useEffect(() => {
    if (!user || !preferences.enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      requestPermission();
    }
  }, [preferences.enabled, requestPermission, user]);

  return null;
}
