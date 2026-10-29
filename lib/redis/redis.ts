import Redis from "ioredis";

type RedisCache = {
  client: Redis | null;
  promise: Promise<Redis | null> | null;
  enabled: boolean;
  disabledUntil: number;
};

declare global {
  var redisCache: RedisCache | undefined;
}

const globalCache: RedisCache = global.redisCache || {
  client: null,
  promise: null,
  enabled: true,
  disabledUntil: 0,
};

globalCache.disabledUntil ??= 0;

global.redisCache = globalCache;

const cached: RedisCache = globalCache;

const REDIS_DISABLED =
  process.env.REDIS_ENABLED === "false" || process.env.REDIS_ENABLED === "0";

const RETRY_COOLDOWN_MS = 15_000;
const DELETE_CHUNK_SIZE = 500;

const CACHE_TTL_SECONDS = {
  messages: 5 * 60,
  groupMessages: 5 * 60,
  conversations: 30,
  statuses: 60,
  userProfile: 5 * 60,
} as const;

export const TTL = CACHE_TTL_SECONDS;

export function isRedisEnabled(): boolean {
  return (
    !REDIS_DISABLED && Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
  );
}

const baseOptions = {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
  lazyConnect: true,
  connectTimeout: 5000,
  commandTimeout: 2000,
  retryStrategy(times: number) {
    if (times > 3) return null;
    return Math.min(times * 200, 1000);
  },
};

function buildClient(): Redis | null {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, baseOptions);
  }

  if (process.env.REDIS_HOST) {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT || 6379),
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB || 0),
      ...baseOptions,
    });
  }

  return null;
}

async function createClient(): Promise<Redis | null> {
  const client = buildClient();

  if (!client) {
    cached.enabled = false;
    return null;
  }

  client.on("error", () => {});
  client.on("end", () => {
    if (cached.client === client) {
      cached.client = null;
      cached.promise = null;
      cached.disabledUntil = Date.now() + RETRY_COOLDOWN_MS;
    }
  });

  try {
    await client.connect();
    cached.client = client;
    return client;
  } catch {
    client.disconnect();
    cached.client = null;
    cached.disabledUntil = Date.now() + RETRY_COOLDOWN_MS;
    return null;
  }
}

export async function getRedis(): Promise<Redis | null> {
  if (REDIS_DISABLED || !cached.enabled) return null;
  if (Date.now() < cached.disabledUntil) return null;

  const current = cached.client;

  if (current) {
    if (current.status === "ready") return current;

    if (current.status === "end") {
      cached.client = null;
      cached.promise = null;
    } else {
      return null;
    }
  }

  if (!cached.promise) {
    cached.promise = createClient();
  }

  const client = await cached.promise;

  if (!client) {
    cached.promise = null;
    return null;
  }

  return client;
}

function cacheIndexBase(key: string): string | null {
  const parts = key.split(":");

  if (parts[0] !== "messages") return null;
  if (parts[1] === "dm" && parts.length >= 4)
    return parts.slice(0, 4).join(":");
  if (parts[1] === "group" && parts.length >= 3)
    return parts.slice(0, 3).join(":");

  return null;
}

const indexKey = (base: string) => `idx:${base}`;

export async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedis();
    if (!client) return null;
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = CACHE_TTL_SECONDS.messages,
): Promise<boolean> {
  try {
    const client = await getRedis();
    if (!client) return false;

    const serialized = JSON.stringify(value);
    const base = cacheIndexBase(key);

    const pipeline = client.pipeline();

    if (ttlSeconds > 0) {
      pipeline.set(key, serialized, "EX", ttlSeconds);
    } else {
      pipeline.set(key, serialized);
    }

    if (base) {
      const idx = indexKey(base);
      pipeline.sadd(idx, key);
      if (ttlSeconds > 0) {
        pipeline.expire(idx, Math.max(ttlSeconds, 3600) + 60);
      }
    }

    await pipeline.exec();
    return true;
  } catch {
    return false;
  }
}

export async function redisDel(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false;

  try {
    const client = await getRedis();
    if (!client) return false;

    for (let i = 0; i < keys.length; i += DELETE_CHUNK_SIZE) {
      await client.unlink(...keys.slice(i, i + DELETE_CHUNK_SIZE));
    }

    return true;
  } catch {
    return false;
  }
}

export async function redisDelPattern(pattern: string): Promise<boolean> {
  try {
    const client = await getRedis();
    if (!client) return false;

    const stream = client.scanStream({ match: pattern, count: 500 });

    for await (const batch of stream as unknown as AsyncIterable<string[]>) {
      if (batch.length > 0) {
        await client.unlink(...batch);
      }
    }

    return true;
  } catch {
    return false;
  }
}

export const CacheKeys = {
  directMessages: (userId: string, peerId: string) => {
    const [a, b] = [userId, peerId].sort();
    return `messages:dm:${a}:${b}`;
  },
  directMessagesPage: (
    userId: string,
    peerId: string,
    limit: number,
    before: string | null,
  ) => {
    const base = CacheKeys.directMessages(userId, peerId);
    const suffix = before ? `:before:${before}` : ":latest";
    return `${base}:user:${userId}:limit:${limit}${suffix}`;
  },
  groupMessages: (groupId: string) => `messages:group:${groupId}`,
  groupMessagesPage: (
    groupId: string,
    limit: number,
    before: string | null,
    userId: string,
  ) => {
    const suffix = before ? `:before:${before}` : ":latest";
    return `messages:group:${groupId}:user:${userId}:limit:${limit}${suffix}`;
  },
  conversations: (userId: string) => `conversations:${userId}`,
  statuses: (userId: string) => `statuses:${userId}`,
  userProfile: (userId: string) => `profile:${userId}`,
  lastSeenSingle: (userId: string) => `lastseen:single:${userId}`,
  lastSeenBatch: (userIds: string[]) => {
    const sorted = [...userIds].sort().join(",");
    return `lastseen:batch:${sorted}`;
  },
};

const INVALIDATE_INDEXED_LUA = `
local members = redis.call('SMEMBERS', KEYS[1])
for i = 1, #members do
  redis.call('UNLINK', members[i])
end
redis.call('UNLINK', KEYS[1], KEYS[2])
return #members`;

async function invalidateIndexed(base: string): Promise<boolean> {
  try {
    const client = await getRedis();
    if (!client) return false;

    await client.eval(INVALIDATE_INDEXED_LUA, 2, indexKey(base), base);
    return true;
  } catch {
    return false;
  }
}

export async function invalidateDirectMessages(userId: string, peerId: string) {
  return invalidateIndexed(CacheKeys.directMessages(userId, peerId));
}

export async function invalidateGroupMessages(groupId: string) {
  return invalidateIndexed(CacheKeys.groupMessages(groupId));
}

export async function invalidateUserConversations(userId: string) {
  return redisDel(CacheKeys.conversations(userId));
}

export async function invalidateUserCache(
  userId: string,
  peerIds?: string[],
  groupIds?: string[],
) {
  const tasks: Promise<boolean>[] = [];
  tasks.push(invalidateUserConversations(userId));
  if (peerIds) {
    for (const pid of peerIds) {
      tasks.push(invalidateDirectMessages(userId, pid));
    }
  }
  if (groupIds) {
    for (const gid of groupIds) {
      tasks.push(invalidateGroupMessages(gid));
    }
  }
  await Promise.all(tasks);
}

export async function wipeAllUserCache(userId: string) {
  return redisDelPattern(`*${userId}*`);
}
