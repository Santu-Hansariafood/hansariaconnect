"use client";

import { useEffect } from "react";
import { useApp } from "@/context/AppContext/AppContext";
import { useNotifications } from "@/hooks/useNotifications";
import { useSocket } from "@/hooks/useSocket";

const getId = (value: unknown) => String(value ?? "");

export default function NotificationManager() {
  const { user } = useApp();
  const { addListener, removeListener } = useSocket();
  const { preferences, playRingtone, showNotification, requestPermission } =
    useNotifications();

  useEffect(() => {
    if (!user || !preferences.enabled) return;

    const handleDirectMessage = (message: any) => {
      if (!preferences.messages) return;
      if (getId(message?.from) === getId(user.id)) return;

      playRingtone(preferences.ringtone || "chime");
      showNotification(
        message?.senderName || "New message",
        message?.text || "You have a new chat message",
        `message-${getId(message?.id || message?._id)}`,
        `/chat/${getId(message?.from)}`,
      );
    };

    const handleGroupMessage = (message: any) => {
      if (!preferences.groups) return;

      playRingtone(preferences.ringtone || "chime");
      showNotification(
        message?.groupName || "New group message",
        message?.text || "You have a new group message",
        `group-${getId(message?.id || message?._id)}`,
        `/chat/${getId(message?.groupId)}`,
      );
    };

    addListener("message:new", handleDirectMessage);
    addListener("group:message:new", handleGroupMessage);

    return () => {
      removeListener("message:new", handleDirectMessage);
      removeListener("group:message:new", handleGroupMessage);
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
