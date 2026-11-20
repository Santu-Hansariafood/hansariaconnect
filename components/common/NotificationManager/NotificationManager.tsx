"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";
import { useSocket } from "@/hooks/useSocket";

const getId = (value: unknown) => String(value ?? "");

type NotifyPayload = {
  kind: "direct" | "group";
  chatId: string;
  messageId?: string;
  chatName: string;
  chatAvatar?: string;
  fromUserId: string;
  fromName: string;
  fromAvatar?: string;
  preview?: string;
  messageType: string;
  mediaUrl?: string;
  timestamp?: string | Date;
  pushDispatched?: boolean;
  fallback?: boolean;
};

const isStandaloneApp = () => {
  if (typeof window === "undefined") return false;
  const standaloneMatch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return standaloneMatch || iosStandalone;
};

const buildUrlFromPayload = (p: NotifyPayload, adminSurface = false) => {
  if (adminSurface) return "/admin";
  const path =
    p.kind === "direct" ? `/chat/${p.chatId}` : `/chat/${p.chatId}?group=true`;
  return path;
};

type NotificationManagerProps = {
  userId?: string | null;
};

export default function NotificationManager({
  userId,
}: NotificationManagerProps) {
  const pathname = usePathname();
  const isAdminSurface = Boolean(
    pathname?.startsWith("/admin") ||
      (typeof window !== "undefined" &&
        /^(admin|super)\./i.test(window.location.hostname)),
  );
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const { socket, addListener, removeListener } = useSocket({
    subscribeOnline: false,
    enabled: Boolean(userId) || Boolean(isAdminSurface && adminUserId),
  });
  const {
    preferences,
    preferencesLoaded,
    playRingtone,
    playStartupTune,
    showNotification,
  } = useNotifications(userId || undefined);
  const activeChatId = useRef<string | null>(null);
  const startupTunePlayed = useRef(false);
  const socketAdminUserId = useRef<string | null>(null);
  const notifiedMessageIds = useRef(new Set<string>());
  const handleNotifyRef = useRef<(payload: NotifyPayload) => void>(() => {});
  const baseDocumentTitleRef = useRef("HansariaConnect");

  useEffect(() => {
    const chatMatch = pathname?.match(/(?:^|\/)chat\/([^/?#]+)/);
    if (!chatMatch) {
      activeChatId.current = null;
      return;
    }
    activeChatId.current = chatMatch[1] || null;
  }, [pathname]);

  useEffect(() => {
    if (!isAdminSurface) return;

    let cancelled = false;
    const loadAdminIdentity = async () => {
      try {
        const response = await fetch("/api/admin/me", {
          credentials: "include",
          cache: "no-store",
        });
        if (response.status === 401) {
          if (!cancelled) setAdminUserId(null);
          return;
        }
        if (!response.ok) {
          console.warn(
            "[NotificationManager] Could not load admin notification identity:",
            response.status,
          );
          return;
        }
        const data = await response.json();
        const userId = data?.admin?.userId;
        if (!cancelled && data?.success && typeof userId === "string") {
          setAdminUserId(userId);
        }
      } catch (error) {
        console.error(
          "[NotificationManager] Failed to load admin notification identity:",
          error,
        );
      }
    };

    void loadAdminIdentity();
    return () => {
      cancelled = true;
    };
  }, [isAdminSurface, pathname]);

  useEffect(() => {
    if (!isAdminSurface || !socket) return;
    if (socketAdminUserId.current === adminUserId) return;

    socketAdminUserId.current = adminUserId;
    socket.disconnect();
    socket.connect();
  }, [adminUserId, isAdminSurface, socket]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      baseDocumentTitleRef.current = document.title || "HansariaConnect";
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const resetDocumentTitle = () => {
      document.title = baseDocumentTitleRef.current;
    };

    const handleVisibilityOrFocus = () => {
      if (
        document.visibilityState === "visible" &&
        (typeof document.hasFocus !== "function" || document.hasFocus())
      ) {
        resetDocumentTitle();
      }
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      resetDocumentTitle();
    };
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || startupTunePlayed.current) return;
    startupTunePlayed.current = true;

    if (!isStandaloneApp()) return;
    void playStartupTune(preferences.ringtone || "whatsapp");
  }, [playStartupTune, preferences.ringtone, preferencesLoaded]);

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
          "The 'Turn on notifications' card (or Settings → Notifications) grants it via a user-gesture.",
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
    const currentUserId = isAdminSurface ? getId(adminUserId) : getId(userId);

    handleNotifyRef.current = (payload: NotifyPayload) => {
      if (!payload || typeof payload !== "object") {
        console.warn(
          "[NotificationManager] ⚠️ message:notify received invalid payload:",
          payload,
        );
        return;
      }
      if (payload.messageId && !payload.fallback) {
        if (notifiedMessageIds.current.has(payload.messageId)) return;
        notifiedMessageIds.current.add(payload.messageId);
        if (notifiedMessageIds.current.size > 200) {
          const oldest = notifiedMessageIds.current.values().next().value;
          if (oldest) notifiedMessageIds.current.delete(oldest);
        }
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
        !isAdminSurface &&
        activeChatId.current &&
        activeChatId.current === payload.chatId;

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

      const notificationTitle =
        payload.kind === "group"
          ? payload.chatName || "New group message"
          : payload.fromName || payload.chatName || "New message";
      const notificationBody = isAdminSurface
        ? payload.kind === "group"
          ? "New message in a group"
          : "You have a new message"
        : payload.preview || "You have a new message";
      const isPageVisible = document.visibilityState === "visible";
      const isWindowFocused = typeof document.hasFocus === "function" ? document.hasFocus() : isPageVisible;
      const isFocusedConversation = Boolean(isActiveChat && isPageVisible && isWindowFocused);

      console.log(
        "[NotificationManager] Focus state check:",
        "| isPageVisible:",
        isPageVisible,
        "| isWindowFocused:",
        isWindowFocused,
        "| isFocusedConversation:",
        isFocusedConversation,
      );

      const titleSource =
        payload.kind === "group"
          ? `${payload.fromName} in ${payload.chatName || "Group"}`
          : payload.fromName || payload.chatName || "New message";

      if (isFocusedConversation) {
        console.log(
          "[NotificationManager] ⏭️ message:notify skipped - this conversation is already open and focused",
        );
        return;
      }

      if (
        typeof document !== "undefined" &&
        (!isPageVisible || !isWindowFocused)
      ) {
        document.title = `${titleSource} - ${baseDocumentTitleRef.current}`;
      }

      const appInForeground = isPageVisible && isWindowFocused;

      console.log(
        "[NotificationManager] → Showing system notification (page:",
        isPageVisible ? "visible" : "hidden",
        "| window:",
        isWindowFocused ? "focused" : "not focused",
        ")",
      );
      void showNotification(
        notificationTitle,
        notificationBody,
        `${payload.kind}-${payload.chatId}`,
        buildUrlFromPayload(payload, isAdminSurface),
        appInForeground,
        isAdminSurface ? undefined : payload.mediaUrl,
        payload.messageId,
        payload.kind === "group"
          ? payload.chatAvatar || payload.fromAvatar
          : payload.fromAvatar || payload.chatAvatar,
      );

      if (appInForeground) {
        void playRingtone(preferences.ringtone || "whatsapp");
      }
    };
  }, [
    adminUserId,
    isAdminSurface,
    playRingtone,
    preferences.groups,
    preferences.messages,
    preferences.ringtone,
    showNotification,
    userId,
  ]);

  useEffect(() => {
    if (
      !preferences.enabled ||
      (isAdminSurface ? !adminUserId : !userId)
    ) {
      return;
    }

    const notificationEvent = isAdminSurface
      ? "admin:message:notify"
      : "message:notify";
    const listener = (payload: NotifyPayload) =>
      handleNotifyRef.current(payload);

    console.log(
      "[NotificationManager] Setting up socket listeners for user:",
      isAdminSurface ? getId(adminUserId) : getId(userId),
    );
    addListener(notificationEvent, listener);

    return () => {
      console.log("[NotificationManager] Removing socket listeners");
      removeListener(notificationEvent, listener);
    };
  }, [
    addListener,
    adminUserId,
    isAdminSurface,
    preferences.enabled,
    removeListener,
    userId,
  ]);

  return null;
}
