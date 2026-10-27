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

// Web Push: raised while the app is closed, so it must show the notification
// itself — WhatsApp-style alerts for a browser that is not running.
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
    vibrate: [0, 200, 100, 200],
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
