"use client";

export interface QueuedMessagePayload {
  type: string;
  clientMessageId: string;
  viewOnce?: boolean;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number;
  linkTitle?: string;
  linkDescription?: string;
}

export interface QueuedMessage {
  clientMessageId: string;
  userId: string;
  targetId: string;
  isGroup: boolean;
  payload: QueuedMessagePayload;
  queuedAt: number;
}

const DATABASE_NAME = "hansariaconnect-sync";
const DATABASE_VERSION = 1;
const STORE_NAME = "outbound-messages";
const SYNC_TAG = "hansariaconnect-outbound-messages";

const openQueueDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "clientMessageId",
        });
        store.createIndex("userId", "userId");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open offline message storage"));
  });

const getQueuedMessages = async (userId: string): Promise<QueuedMessage[]> => {
  const database = await openQueueDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction
        .objectStore(STORE_NAME)
        .index("userId")
        .getAll(userId);
      request.onsuccess = () => resolve(request.result as QueuedMessage[]);
      request.onerror = () =>
        reject(request.error || new Error("Could not read offline messages"));
    });
  } finally {
    database.close();
  }
};

const removeQueuedMessage = async (clientMessageId: string): Promise<void> => {
  const database = await openQueueDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(clientMessageId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("Could not remove queued message"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("Could not remove queued message"));
    });
  } finally {
    database.close();
  }
};

export const clearQueuedMessages = async (userId: string): Promise<void> => {
  const messages = await getQueuedMessages(userId);
  await Promise.all(
    messages.map((message) => removeQueuedMessage(message.clientMessageId)),
  );
};

export const queueMessageForSync = async (
  message: QueuedMessage,
): Promise<void> => {
  const database = await openQueueDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(message);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () =>
        reject(transaction.error || new Error("Could not queue offline message"));
      transaction.onabort = () =>
        reject(transaction.error || new Error("Could not queue offline message"));
    });
  } finally {
    database.close();
  }

  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        if (!registration) return;
        const syncRegistration =
          registration as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          };
        await syncRegistration.sync?.register(SYNC_TAG);
      })
      .catch((error: unknown) =>
        console.warn(
          "[offlineMessageQueue] Background Sync registration failed; queued messages will retry when the app is online:",
          error instanceof Error ? error.message : String(error),
        ),
      );
  }
};

const announceMessageResult = (detail: {
  clientMessageId: string;
  message?: unknown;
  error?: string;
}) => {
  window.dispatchEvent(
    new CustomEvent("hansariaconnect:queued-message-result", { detail }),
  );
};

export const syncQueuedMessages = async (
  userId: string,
  sessionHeaders?: HeadersInit,
): Promise<void> => {
  if (!userId || !navigator.onLine) return;

  let sessionResponse: Response;
  try {
    sessionResponse = await fetch("/api/auth/me", {
      credentials: "include",
      cache: "no-store",
      headers: sessionHeaders,
    });
  } catch (error) {
    console.warn(
      "[offlineMessageQueue] Could not verify the session before retrying queued messages:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }
  if (!sessionResponse.ok) return;
  const sessionData: unknown = await sessionResponse.json().catch(() => null);
  if (
    typeof sessionData !== "object" ||
    sessionData === null ||
    !("user" in sessionData) ||
    typeof sessionData.user !== "object" ||
    sessionData.user === null ||
    !("id" in sessionData.user) ||
    sessionData.user.id !== userId
  ) {
    return;
  }

  const queuedMessages = await getQueuedMessages(userId);
  for (const queued of queuedMessages) {
    const endpoint = queued.isGroup
      ? `/api/groups/${encodeURIComponent(queued.targetId)}/messages`
      : `/api/messages/${encodeURIComponent(queued.targetId)}`;

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify(queued.payload),
      });
    } catch (error) {
      console.warn(
        "[offlineMessageQueue] Message retry failed; keeping it queued:",
        error instanceof Error ? error.message : String(error),
      );
      return;
    }

    if (response.status === 401) return;

    const responseData: unknown = await response.json().catch(() => null);
    if (response.ok) {
      const message =
        typeof responseData === "object" &&
        responseData !== null &&
        "message" in responseData
          ? responseData.message
          : undefined;
      await removeQueuedMessage(queued.clientMessageId);
      announceMessageResult({ clientMessageId: queued.clientMessageId, message });
      continue;
    }

    if (response.status >= 500 || response.status === 408 || response.status === 429) {
      console.warn(
        `[offlineMessageQueue] Message retry returned HTTP ${response.status}; keeping it queued.`,
      );
      return;
    }

    const error =
      typeof responseData === "object" &&
      responseData !== null &&
      "error" in responseData &&
      typeof responseData.error === "string"
        ? responseData.error
        : `Message could not be sent (HTTP ${response.status})`;
    await removeQueuedMessage(queued.clientMessageId);
    announceMessageResult({
      clientMessageId: queued.clientMessageId,
      error,
    });
  }
};
