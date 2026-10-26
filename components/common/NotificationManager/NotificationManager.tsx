"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
};

type ToastNotification = NotifyPayload & { id: number };

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
  const router = useRouter();
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
  const { preferences, playRingtone, showNotification } = useNotifications(userId || undefined);
  const activeChatId = useRef<string | null>(null);
  const socketAdminUserId = useRef<string | null>(null);
  const notifiedMessageIds = useRef(new Set<string>());
  const nextToastId = useRef(0);
  const toastTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const baseDocumentTitleRef = useRef("HansariaConnect");
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  const dismissToast = useCallback((id: number) => {
    const timer = toastTimers.current.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((payload: NotifyPayload) => {
    const id = ++nextToastId.current;
    setToasts((current) => {
      const isSameChat = (toast: ToastNotification) =>
        toast.kind === payload.kind && toast.chatId === payload.chatId;
      // One live toast per conversation, so a busy chat cannot bury the others.
      return [
        { ...payload, id },
        ...current.filter((toast) => !isSameChat(toast)),
      ].slice(0, 3);
    });
    toastTimers.current.set(
      id,
      setTimeout(() => dismissToast(id), 6000),
    );
  }, [dismissToast]);

  useEffect(() => {
    // Release the timers of toasts that were replaced or dropped by the cap.
    const liveToastIds = new Set(toasts.map((toast) => toast.id));
    toastTimers.current.forEach((timer, id) => {
      if (!liveToastIds.has(id)) {
        clearTimeout(timer);
        toastTimers.current.delete(id);
      }
    });
  }, [toasts]);

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
      (isAdminSurface ? !adminUserId : !userId)
    ) {
      return;
    }

    const currentUserId = isAdminSurface ? getId(adminUserId) : getId(userId);
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
      const runningAsInstalledApp = isStandaloneApp();
      /*
       * The in-app tone only rings while the user is actually in the app.
       * When the app is hidden the OS notification already plays the device
       * alert sound, and firing both makes the tone sound doubled and mushy.
       */
      const isAppInUse = isPageVisible && isWindowFocused;

      console.log(
        "[NotificationManager] Focus state check:",
        "| isPageVisible:",
        isPageVisible,
        "| isWindowFocused:",
        isWindowFocused,
        "| isFocusedConversation:",
        isFocusedConversation,
        "| standalone:",
        runningAsInstalledApp,
      );

      if (!isFocusedConversation && isAppInUse) {
        playRingtone(preferences.ringtone || "whatsapp");
      }

      const showBrowserNotification =
        !isFocusedConversation &&
        (!isPageVisible || !isWindowFocused || runningAsInstalledApp);
      const showInAppToast = isPageVisible && isWindowFocused;
      const titleSource =
        payload.kind === "group"
          ? `${payload.fromName} in ${payload.chatName || "Group"}`
          : payload.fromName || payload.chatName || "New message";

      if (
        typeof document !== "undefined" &&
        !isFocusedConversation &&
        (!isPageVisible || !isWindowFocused)
      ) {
        document.title = `${titleSource} - ${baseDocumentTitleRef.current}`;
      }

      if (showInAppToast) {
        addToast({
          ...payload,
          chatName: notificationTitle,
          preview: notificationBody,
        });
      }

      if (showBrowserNotification) {
        console.log(
          "[NotificationManager] → Showing browser notification (page:",
          isPageVisible ? "visible" : "hidden",
          "| window:",
          isWindowFocused ? "focused" : "not focused",
          ")",
        );
        showNotification(
          notificationTitle,
          notificationBody,
          /*
           * One tray entry per conversation: a follow-up message replaces the
           * notification already showing for that chat instead of stacking a
           * separate one for every message.
           */
          `${payload.kind}-${payload.chatId}`,
          buildUrlFromPayload(payload, isAdminSurface),
          // The in-app tone already rang, so keep the OS notification quiet.
          isAppInUse,
          // Photos and videos preview themselves inside the notification.
          isAdminSurface ? undefined : payload.mediaUrl,
        );
      }
    };

    const notificationEvent = isAdminSurface
      ? "admin:message:notify"
      : "message:notify";
    addListener(notificationEvent, handleNotify);

    return () => {
      console.log("[NotificationManager] Removing socket listeners");
      removeListener(notificationEvent, handleNotify);
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
    userId,
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
      className="pointer-events-none fixed left-3 right-3 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[10000] flex flex-col gap-2 sm:left-auto sm:right-4 sm:w-[min(24rem,calc(100vw-2rem))]"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: -14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
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
              className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
