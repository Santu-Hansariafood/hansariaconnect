const CACHE_NAME = "hansariaconnect-shell-v1";
const SYNC_DATABASE_NAME = "hansariaconnect-sync";
const SYNC_DATABASE_VERSION = 1;
const OUTBOUND_STORE_NAME = "outbound-messages";
const OUTBOUND_SYNC_TAG = "hansariaconnect-outbound-messages";
const PERIODIC_SYNC_TAG = "hansariaconnect-refresh";

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

const notifyClients = async (message) => {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });
  clients.forEach((client) => client.postMessage(message));
};

const openSyncDatabase = () =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DATABASE_NAME, SYNC_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(OUTBOUND_STORE_NAME)) {
        const store = database.createObjectStore(OUTBOUND_STORE_NAME, {
          keyPath: "clientMessageId",
        });
        store.createIndex("userId", "userId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open sync storage"));
  });

const getQueuedMessages = async () => {
  const database = await openSyncDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(OUTBOUND_STORE_NAME, "readonly")
        .objectStore(OUTBOUND_STORE_NAME)
        .getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Could not read queued messages"));
    });
  } finally {
    database.close();
  }
};

const removeQueuedMessage = async (clientMessageId) => {
  const database = await openSyncDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(OUTBOUND_STORE_NAME, "readwrite");
      transaction.objectStore(OUTBOUND_STORE_NAME).delete(clientMessageId);
      transaction.oncomplete = resolve;
      transaction.onerror = () =>
        reject(transaction.error || new Error("Could not remove queued message"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("Could not remove queued message"));
    });
  } finally {
    database.close();
  }
};

const sendQueuedMessages = async () => {
  const sessionResponse = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });
  if (sessionResponse.status === 401) return;
  if (!sessionResponse.ok) {
    throw new Error(`Session check returned HTTP ${sessionResponse.status}`);
  }

  const session = await sessionResponse.json();
  const userId = session?.user?.id;
  if (typeof userId !== "string") {
    throw new Error("Session check returned an invalid user");
  }

  const queuedMessages = await getQueuedMessages();
  for (const queued of queuedMessages) {
    if (queued.userId !== userId) continue;

    const endpoint = queued.isGroup
      ? `/api/groups/${encodeURIComponent(queued.targetId)}/messages`
      : `/api/messages/${encodeURIComponent(queued.targetId)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify(queued.payload),
    });

    if (response.status === 401) return;
    const responseData = await response.json().catch(() => null);
    if (response.ok) {
      await removeQueuedMessage(queued.clientMessageId);
      await notifyClients({
        type: "QUEUED_MESSAGE_RESULT",
        clientMessageId: queued.clientMessageId,
        message: responseData?.message,
      });
      continue;
    }

    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      throw new Error(`Queued message retry returned HTTP ${response.status}`);
    }

    await removeQueuedMessage(queued.clientMessageId);
    await notifyClients({
      type: "QUEUED_MESSAGE_RESULT",
      clientMessageId: queued.clientMessageId,
      error:
        typeof responseData?.error === "string"
          ? responseData.error
          : `Message could not be sent (HTTP ${response.status})`,
    });
  }
};

self.addEventListener("sync", (event) => {
  if (event.tag === OUTBOUND_SYNC_TAG) {
    event.waitUntil(sendQueuedMessages());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag !== PERIODIC_SYNC_TAG) return;

  event.waitUntil(
    Promise.all(
      ["/api/conversations", "/api/status", "/api/unread-counts"].map(
        async (url) => {
          const response = await fetch(url, {
            credentials: "include",
            cache: "no-store",
          });
          if (response.status === 401) return;
          if (!response.ok) {
            throw new Error(`Background refresh ${url} returned HTTP ${response.status}`);
          }
        },
      ),
    ).then(() => notifyClients({ type: "BACKGROUND_SYNC_COMPLETE" })),
  );
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

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      notifyClients({ type: "PUSH_RECEIVED" }),
    ]),
  );
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
