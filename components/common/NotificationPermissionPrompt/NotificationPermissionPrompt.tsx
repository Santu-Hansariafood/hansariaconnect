"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BellRing, X } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { ensurePushSubscription } from "@/lib/pushClient";

type PermissionState = "unsupported" | "default" | "granted" | "denied";

/**
 * Remembers that the card was dealt with, so it is shown once per device
 * instead of nagging on every page load.
 */
const DISMISS_KEY = "hansariaconnect.notificationPromptDismissed";

/*
 * Permission lives outside React: the browser can flip it behind our back
 * (address-bar settings, or another tab). Reading it through an external store
 * keeps the first paint hydration-safe, because React renders the server
 * snapshot ("unsupported" → hidden) and only then switches to the real value.
 */
const readPermission = (): PermissionState => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission as PermissionState;
};

const readServerPermission = (): PermissionState => "unsupported";

const subscribeToPermission = (onChange: () => void) => {
  if (typeof window === "undefined") return () => {};

  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
};

const readDismissed = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
};

type NotificationPermissionPromptProps = {
  userId?: string | null;
};

export default function NotificationPermissionPrompt({
  userId,
}: NotificationPermissionPromptProps) {
  const permission = useSyncExternalStore(
    subscribeToPermission,
    readPermission,
    readServerPermission,
  );
  const [dismissed, setDismissed] = useState(readDismissed);
  const [requesting, setRequesting] = useState(false);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  }, []);

  /*
   * Devices that granted permission before Web Push existed get subscribed the
   * next time the app opens — no extra click, no missing notifications.
   */
  useEffect(() => {
    if (permission === "granted") void ensurePushSubscription();
  }, [permission]);

  const handleEnable = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    setRequesting(true);
    try {
      const result = await Notification.requestPermission();

      if (result === "granted") {
        // Register for Web Push straight away, so alerts also arrive once the
        // browser is fully closed.
        await ensurePushSubscription();
        dismiss();
      }
    } catch (error) {
      console.error(
        "[NotificationPermissionPrompt] Could not request permission:",
        error,
      );
    } finally {
      setRequesting(false);
    }
  }, [dismiss]);

  const visible = Boolean(userId) && permission === "default" && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
          className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-[9999] flex justify-center px-3 sm:top-[calc(env(safe-area-inset-top)+4.4rem)]"
        >
          <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border border-emerald-100 bg-white p-4 shadow-xl shadow-black/15">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <BellRing className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                Turn on notifications
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-gray-600">
                Get alerts for new messages, even when HansariaConnect is closed.
              </p>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnable}
                  disabled={requesting}
                  className="min-h-[44px] flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {requesting ? "Requesting…" : "Turn on"}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                >
                  Not now
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss notifications prompt"
              className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
