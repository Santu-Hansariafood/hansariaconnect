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
    if (typeof window !== "undefined" && "Notification" in window) {
      console.log(
        "[NotificationManager] Mounted. Current Notification permission state:",
        Notification.permission,
        "- preferences.enabled:",
        preferences.enabled,
      );
      if (Notification.permission === "default") {
        console.warn(
          "[NotificationManager] ⚠️ Notification permission is 'default'.",
          "Automatic permission prompts are BLOCKED by modern browsers.",
          "User MUST click the 'Allow Notifications' button in Settings → Notifications to grant permission via a user-gesture.",
        );
      } else if (Notification.permission === "denied") {
        console.warn(
          "[NotificationManager] ❌ Notification permission is 'DENIED'.",
          "Tell user to click 'How to Unblock' in Settings → Notifications.",
        );
      } else if (Notification.permission === "granted") {
        console.log(
          "[NotificationManager] ✅ Notification permission is GRANTED. Ready to receive.",
        );
      }
    } else if (typeof window !== "undefined") {
      console.warn(
        "[NotificationManager] Notification API is not supported in this browser.",
      );
    }
  }, [preferences.enabled]);

  useEffect(() => {
    if (!user || !preferences.enabled) return;

    const currentUserId = getId(user.id);
    console.log(
      "[NotificationManager] Setting up socket listeners for user:",
      currentUserId,
      "| activeChatId:",
      activeChatId.current,
    );

    const handleDirectMessage = (message: any) => {
      if (!preferences.messages) {
        console.log(
          "[NotificationManager] ⏭️ message:new skipped - DM notifications disabled in preferences",
        );
        return;
      }
      if (getId(message?.from) === currentUserId) {
        console.log(
          "[NotificationManager] ⏭️ message:new skipped - message is from self",
        );
        return;
      }
      const senderId = getId(message?.from ?? message?.senderId);
      const isActiveChat = activeChatId.current === senderId;
      const preview =
        message?.text ||
        (message?.type === "image"
          ? "📷 Photo"
          : message?.type === "video"
            ? "🎥 Video"
            : message?.type === "audio"
              ? "🎵 Voice"
              : message?.type === "file"
                ? "📎 File"
                : "New message");

      console.log(
        "[NotificationManager] 📩 message:new RECEIVED",
        "| from:",
        senderId,
        "| senderName:",
        message?.senderName || message?.fromName || "unknown",
        "| isActiveChat:",
        isActiveChat,
        "| preview:",
        preview,
      );

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          message?.senderName || message?.fromName || "New message",
          preview,
          `message-${getId(message?.id || message?._id || Date.now())}`,
          `/chat/${senderId}`,
        );
      } else {
        console.log(
          "[NotificationManager] ⏭️ Skipping in-page notification - user is currently viewing this chat",
        );
      }
    };

    const handleGroupMessage = (message: any) => {
      if (!preferences.groups) {
        console.log(
          "[NotificationManager] ⏭️ group:message:new skipped - group notifications disabled in preferences",
        );
        return;
      }
      if (getId(message?.from) === currentUserId) {
        console.log(
          "[NotificationManager] ⏭️ group:message:new skipped - message is from self",
        );
        return;
      }
      const groupId = getId(message?.groupId);
      const isActiveChat = activeChatId.current === groupId;
      const preview =
        message?.text ||
        (message?.type === "image"
          ? "📷 Photo"
          : message?.type === "video"
            ? "🎥 Video"
            : message?.type === "audio"
              ? "🎵 Voice"
              : message?.type === "file"
                ? "📎 File"
                : "New group message");

      console.log(
        "[NotificationManager] 👥 group:message:new RECEIVED",
        "| groupId:",
        groupId,
        "| from:",
        getId(message?.from),
        "| groupName:",
        message?.groupName || "unknown",
        "| isActiveChat:",
        isActiveChat,
        "| preview:",
        preview,
      );

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          message?.groupName || "New group message",
          preview,
          `group-${getId(message?.id || message?._id || Date.now())}`,
          `/chat/${groupId}?group=true`,
        );
      } else {
        console.log(
          "[NotificationManager] ⏭️ Skipping in-page notification - user is currently viewing this group chat",
        );
      }
    };

    const handleNotify = (payload: NotifyPayload) => {
      if (!payload || typeof payload !== "object") {
        console.warn(
          "[NotificationManager] ⚠️ message:notify received invalid payload:",
          payload,
        );
        return;
      }
      if (payload.fromUserId === currentUserId) {
        console.log(
          "[NotificationManager] ⏭️ message:notify skipped - notification is from self",
        );
        return;
      }

      const kindOk =
        payload.kind === "direct" ? preferences.messages : preferences.groups;
      if (!kindOk) {
        console.log(
          "[NotificationManager] ⏭️ message:notify skipped -",
          payload.kind,
          "notifications are disabled in preferences",
        );
        return;
      }

      const isActiveChat =
        activeChatId.current && activeChatId.current === payload.chatId;

      console.log(
        "[NotificationManager] 🔔 message:notify RECEIVED",
        "| kind:",
        payload.kind,
        "| chatId:",
        payload.chatId,
        "| chatName:",
        payload.chatName,
        "| fromUserId:",
        payload.fromUserId,
        "| fromName:",
        payload.fromName,
        "| isActiveChat:",
        !!isActiveChat,
        "| preview:",
        payload.preview,
      );

      playRingtone(preferences.ringtone || "chime");

      if (!isActiveChat) {
        showNotification(
          payload.chatName ||
            (payload.kind === "direct" ? "New message" : "New group message"),
          payload.preview || "You have a new message",
          `${payload.kind}-${payload.chatId}-${Date.now()}`,
          buildUrlFromPayload(payload),
        );
      } else {
        console.log(
          "[NotificationManager] ⏭️ Skipping notification - user is currently viewing this chat",
        );
      }
    };

    addListener("message:new", handleDirectMessage);
    addListener("group:message:new", handleGroupMessage);
    addListener("message:notify", handleNotify);

    return () => {
      console.log("[NotificationManager] Removing socket listeners");
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

  return null;
}
