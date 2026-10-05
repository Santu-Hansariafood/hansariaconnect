"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
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
  timestamp?: string | Date;
};

type ToastNotification = NotifyPayload & { id: number };

const buildUrlFromPayload = (p: NotifyPayload, adminSurface = false) => {
  if (adminSurface) return "/admin";
  const path =
    p.kind === "direct" ? `/chat/${p.chatId}` : `/chat/${p.chatId}?group=true`;
  return path;
};

export default function NotificationManager() {
  const { user } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const { addListener, removeListener } = useSocket();
  const { preferences, playRingtone, showNotification } = useNotifications();
  const activeChatId = useRef<string | null>(null);
  const notifiedMessageIds = useRef(new Set<string>());
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const isAdminSurface = Boolean(
    pathname?.startsWith("/admin") ||
      (typeof window !== "undefined" &&
        /^(admin|super)\./i.test(window.location.hostname)),
  );

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((payload: NotifyPayload) => {
    const id = ++nextToastId.current;
    setToasts((current) => [{ ...payload, id }, ...current].slice(0, 3));
    toastTimers.current.set(
      id,
      setTimeout(() => dismissToast(id), 6000),
    );
  }, [dismissToast]);

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
        if (!response.ok) return;
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
    if (
      !preferences.enabled ||
      (isAdminSurface ? !adminUserId : !user)
    ) {
      return;
    }

    const currentUserId = isAdminSurface ? getId(adminUserId) : getId(user?.id);
    console.log(
      "[NotificationManager] Setting up socket listeners for user:",
      currentUserId,
      "| activeChatId:",
      activeChatId.current,
    );

    const handleNotify = (payload: NotifyPayload) => {
      if (!payload || typeof payload !== "object") {
        console.warn(
          "[NotificationManager] ⚠️ message:notify received invalid payload:",
          payload,
        );
        return;
      }
      if (payload.messageId) {
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

      if (document.visibilityState === "visible") {
        playRingtone(preferences.ringtone || "chime");
      }

      const notificationTitle =
        payload.kind === "group"
          ? payload.chatName || "New group message"
          : payload.fromName || payload.chatName || "New message";
      const notificationBody = isAdminSurface
        ? payload.kind === "group"
          ? "New message in a group"
          : "You have a new message"
        : payload.preview || "You have a new message";
      if (document.visibilityState === "visible") {
        addToast({
          ...payload,
          chatName: notificationTitle,
          preview: notificationBody,
        });
      } else {
        showNotification(
          notificationTitle,
          notificationBody,
          `${payload.kind}-${payload.chatId}-${Date.now()}`,
          buildUrlFromPayload(payload, isAdminSurface),
        );
      }
    };

    const handleMessageFallback = (
      message: {
        id?: string;
        _id?: string;
        from?: string;
        groupId?: string;
        type?: string;
        text?: string;
        fileName?: string;
        linkTitle?: string;
        createdAt?: string | Date;
        timestamp?: string | Date;
      },
      kind: "direct" | "group",
    ) => {
      const messageId = String(message?.id || message?._id || "");
      const fromUserId = String(message?.from || "");
      const chatId =
        kind === "group"
          ? String(message?.groupId || "")
          : fromUserId;
      if (
        !messageId ||
        !fromUserId ||
        !chatId ||
        fromUserId === currentUserId ||
        notifiedMessageIds.current.has(messageId)
      ) {
        return;
      }
      const preview =
        message.type === "image"
          ? "Photo"
          : message.type === "video"
            ? "Video"
            : message.type === "voice"
              ? "Voice message"
              : message.type === "file"
                ? message.fileName || "File"
                : message.type === "link"
                  ? message.linkTitle || "Link"
                  : message.text || "New message";
      handleNotify({
        kind,
        chatId,
        messageId,
        chatName: kind === "group" ? "New group message" : "New message",
        fromUserId,
        fromName: kind === "group" ? "Group member" : "New message",
        preview,
        messageType: message.type || "text",
        timestamp: message.createdAt || message.timestamp,
      });
    };

    const handleDirectMessage = (message: Parameters<typeof handleMessageFallback>[0]) => {
      handleMessageFallback(message, "direct");
    };
    const handleGroupMessage = (message: Parameters<typeof handleMessageFallback>[0]) => {
      handleMessageFallback(message, "group");
    };

    const notificationEvent = isAdminSurface
      ? "admin:message:notify"
      : "message:notify";
    addListener(notificationEvent, handleNotify);
    if (!isAdminSurface) {
      addListener("message:new", handleDirectMessage);
      addListener("group:message:new", handleGroupMessage);
    }

    return () => {
      console.log("[NotificationManager] Removing socket listeners");
      removeListener(notificationEvent, handleNotify);
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
    addToast,
    isAdminSurface,
    adminUserId,
    user,
  ]);

  useEffect(
    () => () => {
      toastTimers.current.forEach((timer) => clearTimeout(timer));
      toastTimers.current.clear();
    },
    [],
  );

  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[10000] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-3 shadow-xl shadow-black/15"
        >
          <button
            type="button"
            onClick={() => {
              dismissToast(toast.id);
              if (!isAdminSurface) {
                router.push(buildUrlFromPayload(toast));
              }
            }}
            disabled={isAdminSurface}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={
              isAdminSurface
                ? `New message notification from ${toast.fromName}`
                : `Open chat with ${toast.fromName}`
            }
          >
            <Image
              src={
                (toast.kind === "group" ? toast.chatAvatar : toast.fromAvatar) ||
                "/logo/logo.png"
              }
              alt=""
              width={44}
              height={44}
              unoptimized
              onError={(event) => {
                event.currentTarget.src = "/logo/logo.png";
              }}
              className="h-11 w-11 shrink-0 rounded-full object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">
                  {toast.kind === "group"
                    ? toast.chatName || "Group"
                    : toast.fromName || "New message"}
                </span>
                <span className="shrink-0 text-xs text-gray-400">now</span>
              </span>
              {toast.kind === "group" && (
                <span className="block truncate text-xs font-medium text-emerald-700">
                  {toast.fromName}
                </span>
              )}
              <span className="block truncate text-sm text-gray-600">
                {toast.kind === "group" &&
                toast.preview?.startsWith(`${toast.fromName}: `)
                  ? toast.preview.slice(toast.fromName.length + 2)
                  : toast.preview || "You have a new message"}
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
            className="self-start rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
