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

/*
 * Hands the payload to every open page and waits for one of them to confirm it
 * rang the recipient's chosen tone. The confirmation decides whether the
 * notification we show can stay silent — a page that never answers (a frozen
 * tab, or no page at all) means the device's own notification sound has to do
 * the alerting.
 */
const requestClientAlert = (clients, payload) => {
  return new Promise((resolve) => {
    if (!clients.length) {
      resolve(false);
      return;
    }

    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    clients.forEach((client) => {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) =>
        finish(Boolean(event.data && event.data.alerted));
      try {
        client.postMessage({ type: "PUSH_RECEIVED", payload }, [channel.port2]);
      } catch {
        // A client that refuses the message simply never confirms.
      }
    });
  });
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
 * or socket is alive. When a page of this app is still running, the push is
 * relayed to it and the page rings the recipient's own chosen tone, so the
 * notification we show here stays silent to avoid a second sound; only when no
 * page answers do we fall back to the device's own notification tone via
 * `silent: false`. Consecutive messages of one chat share a tag and stack into
 * a single notification whose body counts them, like a native messaging app.
 */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const toAbsoluteUrl = (value) => {
    if (!value) return undefined;
    if (
      /^https?:\/\//i.test(value) ||
      String(value).startsWith("data:") ||
      String(value).startsWith("blob:")
    ) {
      return value;
    }
    try {
      return new URL(value, self.location.origin).href;
    } catch {
      return value;
    }
  };

  const title = payload.title || "HansariaConnect";
  const icon =
    toAbsoluteUrl(payload.icon) ||
    toAbsoluteUrl("/favicon/android-chrome-192x192.png");
  const image = toAbsoluteUrl(payload.image);
  const targetUrl = toAbsoluteUrl(payload.url || "/chat") || "/chat";
  const tag = payload.tag;
  const messageId = payload.messageId;

  event.waitUntil(
    (async () => {
      let clients = [];
      try {
        clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
      } catch {
        clients = [];
      }

      // A page that answers rings the chosen tone, which keeps us silent.
      const ringOnPage = await Promise.race([
        requestClientAlert(clients, payload),
        new Promise((resolve) => setTimeout(() => resolve(false), 500)),
      ]).catch(() => false);

      let count = 1;
      let messageIds = [];
      let isDuplicate = false;

      if (tag) {
        try {
          const existing = await self.registration.getNotifications({ tag });
          const previousData = (existing[0] && existing[0].data) || {};
          const previousIds = Array.isArray(previousData.messageIds)
            ? previousData.messageIds
            : previousData.messageId
              ? [previousData.messageId]
              : [];

          if (messageId && previousIds.includes(messageId)) {
            isDuplicate = true;
          } else {
            messageIds = messageId
              ? previousIds.concat(messageId).slice(-25)
              : previousIds;
            count = messageId
              ? (typeof previousData.count === "number"
                  ? previousData.count
                  : 0) + 1
              : 1;
          }
        } catch {
          // Fall back to a single-message alert.
        }
      }

      if (isDuplicate) return;

      const options = {
        body:
          messageId && count > 1
            ? `${count} new messages`
            : payload.body || "You have a new message",
        icon,
        image,
        badge: toAbsoluteUrl("/favicon/android-chrome-192x192.png"),
        tag,
        renotify: Boolean(tag) && !ringOnPage,
        silent: ringOnPage,
        requireInteraction: true,
        vibrate: ringOnPage ? undefined : [0, 200, 100, 200],
        timestamp: payload.timestamp || Date.now(),
        actions: [{ action: "open", title: "Open chat" }],
        data: {
          url: targetUrl,
          tag,
          messageId,
          count,
          messageIds,
        },
      };

      await self.registration.showNotification(title, options);
    })(),
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
