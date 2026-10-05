import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import type { Server } from "socket.io";

type RedisClients = {
  publisher: Redis;
  subscriber: Redis;
};

type SocketRedisState = {
  clients: RedisClients | null;
  promise: Promise<RedisClients | null> | null;
};

declare global {
  var socketRedisState: SocketRedisState | undefined;
}

const state =
  global.socketRedisState ??
  (global.socketRedisState = { clients: null, promise: null });

const redisConfigured = () =>
  Boolean(process.env.REDIS_URL || process.env.REDIS_HOST) &&
  process.env.REDIS_ENABLED !== "false" &&
  process.env.REDIS_ENABLED !== "0";

const createClient = () => {
  const options = {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (attempt: number) => Math.min(attempt * 500, 5000),
  };

  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, options);
  }

  return new Redis({
    ...options,
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT || 6379),
    username: process.env.REDIS_USERNAME || undefined,
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
  });
};

const waitUntilReady = (client: Redis, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    if (client.status === "ready") {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out connecting Socket.IO to Redis"));
    }, timeoutMs);

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onEnd = () => {
      cleanup();
      reject(new Error("Socket.IO Redis connection ended before becoming ready"));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("ready", onReady);
      client.off("end", onEnd);
    };

    client.once("ready", onReady);
    client.once("end", onEnd);
  });

const connectClients = async (): Promise<RedisClients | null> => {
  if (!redisConfigured()) {
    console.warn(
      "[Socket.IO] Redis adapter is not configured; realtime broadcasts are limited to this server instance.",
    );
    return null;
  }

  if (!state.promise) {
    state.promise = (async () => {
      const publisher = createClient();
      const subscriber = publisher.duplicate();
      publisher.on("error", (error) =>
        console.error("[Socket.IO] Redis publisher error:", error.message),
      );
      subscriber.on("error", (error) =>
        console.error("[Socket.IO] Redis subscriber error:", error.message),
      );

      try {
        await Promise.all([
          publisher.connect().catch(() => undefined),
          subscriber.connect().catch(() => undefined),
        ]);
        await Promise.all([
          waitUntilReady(publisher, 15_000),
          waitUntilReady(subscriber, 15_000),
        ]);
        const clients = { publisher, subscriber };
        state.clients = clients;
        return clients;
      } catch (error) {
        publisher.disconnect();
        subscriber.disconnect();
        state.promise = null;
        throw error;
      }
    })();
  }

  return state.promise;
};

export async function configureSocketRedisAdapter(
  io: Server,
): Promise<void> {
  const clients = await connectClients();
  if (clients) {
    io.adapter(
      createAdapter(clients.publisher, clients.subscriber, {
        key: process.env.SOCKET_IO_REDIS_KEY || "hansariaconnect:socket.io",
        requestsTimeout: 5_000,
      }),
    );
    console.info("[Socket.IO] Redis adapter enabled for cross-server events.");
  }
}

export async function getSocketRedisClient(): Promise<Redis | null> {
  if (!redisConfigured()) return null;
  const clients = await state.promise;
  return clients?.publisher ?? null;
}
