const CACHE_NAME = "hansariaconnect-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Allows the page to force a waiting worker to activate immediately
// (used when the app detects a new version while the user is mid-typing).
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  // Keep authenticated chat and API responses network-only.
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) {
    return;
  }
});

/*
 * Web Push: raised while the app is minimised or closed — the push service
 * wakes this worker over the internet, so the alert arrives even though no page
 * or socket is alive. The notification itself carries the sound: `silent` must
 * stay false for the device to play its alert tone, and `vibrate` gives the
 * same double buzz the in-app alert uses. The tone and its volume are owned by
 * the OS/device notification settings — the web Notification API cannot pick a
 * sound file or a per-notification volume.
 */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "HansariaConnect";
  const options = {
    body: payload.body || "You have a new message",
    icon: payload.image || payload.icon || "/logo/logo.png",
    image: payload.image,
    badge: "/logo/logo.png",
    tag: payload.tag,
    renotify: Boolean(payload.tag),
    silent: false,
    vibrate: [0, 200, 100, 200],
    timestamp: payload.timestamp || Date.now(),
    data: { url: payload.url || "/chat", timestamp: payload.timestamp },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/chat";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(targetUrl);
        return existing.focus();
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
