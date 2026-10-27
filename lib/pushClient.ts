const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

/**
 * Browser-side Web Push wiring. Keeps exactly one subscription per device and
 * mirrors it to the server so alerts can be delivered while the app is closed.
 */

const urlBase64ToUint8Array = (base64: string) => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  // Backed by a plain ArrayBuffer so it satisfies PushManager's BufferSource.
  const output = new Uint8Array(new ArrayBuffer(raw.length));

  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }

  return output;
};

/** How long to wait for the app's service worker registration to go active. */
const SERVICE_WORKER_WAIT_MS = 8000;

const getRegistration = async (): Promise<ServiceWorkerRegistration | null> => {
  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
  } catch (error) {
    console.warn("[pushClient] getRegistration() failed:", error);
  }

  /*
   * Registration happens at app start, so a short wait covers the race. It must
   * not wait forever though: if registration failed, `ready` never settles and
   * every later attempt would be blocked behind it.
   */
  return new Promise<ServiceWorkerRegistration | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), SERVICE_WORKER_WAIT_MS);

    navigator.serviceWorker.ready.then(
      (registration) => {
        clearTimeout(timer);
        resolve(registration);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
};

export const isPushSupported = (): boolean =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  Boolean(VAPID_PUBLIC_KEY);

const subscribe = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  if (!isPushSupported()) {
    if (!VAPID_PUBLIC_KEY) {
      console.warn(
        "[pushClient] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing; Web Push stays disabled.",
      );
    }
    return false;
  }

  const registration = await getRegistration();
  if (!registration) {
    console.warn("[pushClient] No service worker registration available yet.");
    return false;
  }

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!p256dh || !auth) {
    console.warn("[pushClient] Subscription is missing its encryption keys.");
    return false;
  }

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      keys: { p256dh, auth },
    }),
  });

  if (!response.ok) {
    console.warn("[pushClient] Could not store the subscription:", response.status);
    return false;
  }

  return true;
};

let inFlight: Promise<boolean> | null = null;

/** Idempotent: safe to call on every mount, focus or permission grant. */
export const ensurePushSubscription = (): Promise<boolean> => {
  if (!inFlight) {
    inFlight = subscribe()
      .catch((error) => {
        console.warn("[pushClient] Subscription failed:", error);
        return false;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
};

export const disablePushSubscription = async (): Promise<void> => {
  if (!isPushSupported()) return;

  try {
    const registration = await getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (!subscription) return;

    const { endpoint } = subscription;
    await subscription.unsubscribe().catch(() => false);

    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ endpoint }),
    });
  } catch (error) {
    console.warn("[pushClient] Could not remove the subscription:", error);
  }
};
