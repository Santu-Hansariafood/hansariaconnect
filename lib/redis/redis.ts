import Redis from "ioredis"

type RedisCache = {
  client: Redis | null
  promise: Promise<Redis> | null
  enabled: boolean
}

declare global {
  var redisCache: RedisCache | undefined
}

const globalCache: RedisCache = global.redisCache || {
  client: null,
  promise: null,
  enabled: true,
}

global.redisCache = globalCache

const cached: RedisCache = globalCache

const REDIS_DISABLED =
  process.env.REDIS_ENABLED === "false" ||
  process.env.REDIS_ENABLED === "0"

const CACHE_TTL_SECONDS = {
  messages: 5 * 60,
  groupMessages: 5 * 60,
  conversations: 30,
  statuses: 60,
  userProfile: 5 * 60,
} as const

export const TTL = CACHE_TTL_SECONDS

export function isRedisEnabled(): boolean {
  return !REDIS_DISABLED && Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
}

export async function getRedis(): Promise<Redis | null> {
  if (REDIS_DISABLED) return null

  if (cached.client) {
    if (cached.client.status === "ready" || cached.client.status === "connecting") {
      return cached.client
    }
  }

  if (!cached.promise) {
    cached.promise = (async () => {
      try {
        let client: Redis

        if (process.env.REDIS_URL) {
          client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            enableReadyCheck: true,
            lazyConnect: true,
            retryStrategy(times) {
              if (times > 3) return null
              return Math.min(times * 200, 1000)
            },
          })
        } else if (process.env.REDIS_HOST) {
          client = new Redis({
            host: process.env.REDIS_HOST,
            port: Number(process.env.REDIS_PORT || 6379),
            username: process.env.REDIS_USERNAME || undefined,
            password: process.env.REDIS_PASSWORD || undefined,
            db: Number(process.env.REDIS_DB || 0),
            maxRetriesPerRequest: 1,
            enableReadyCheck: true,
            lazyConnect: true,
            retryStrategy(times) {
              if (times > 3) return null
              return Math.min(times * 200, 1000)
            },
          })
        } else {
          cached.enabled = false
          return null as unknown as Redis
        }

        await client.connect().catch(() => {})

        client.on("error", () => {})
        client.on("end", () => {})

        cached.client = client
        return client
      } catch {
        cached.enabled = false
        cached.promise = null
        return null as unknown as Redis
      }
    })()
  }

  const result = await cached.promise
  if (!result || !cached.enabled) return null
  return cached.client
}

export async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getRedis()
    if (!client) return null
    const raw = await client.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = CACHE_TTL_SECONDS.messages,
): Promise<boolean> {
  try {
    const client = await getRedis()
    if (!client) return false
    const serialized = JSON.stringify(value)
    if (ttlSeconds > 0) {
      await client.set(key, serialized, "EX", ttlSeconds)
    } else {
      await client.set(key, serialized)
    }
    return true
  } catch {
    return false
  }
}

export async function redisDel(...keys: string[]): Promise<boolean> {
  if (keys.length === 0) return false
  try {
    const client = await getRedis()
    if (!client) return false
    await client.del(keys)
    return true
  } catch {
    return false
  }
}

export async function redisDelPattern(pattern: string): Promise<boolean> {
  try {
    const client = await getRedis()
    if (!client) return false
    const keys: string[] = []
    const stream = client.scanStream({ match: pattern, count: 100 })
    for await (const batch of stream as unknown as AsyncIterable<string[]>) {
      keys.push(...batch)
    }
    if (keys.length > 0) {
      await client.del(keys)
    }
    return true
  } catch {
    return false
  }
}

export const CacheKeys = {
  directMessages: (userId: string, peerId: string) => {
    const [a, b] = [userId, peerId].sort()
    return `messages:dm:${a}:${b}`
  },
  directMessagesPage: (
    userId: string,
    peerId: string,
    limit: number,
    before: string | null,
  ) => {
    const base = CacheKeys.directMessages(userId, peerId)
    const suffix = before ? `:before:${before}` : ":latest"
    return `${base}:limit:${limit}${suffix}`
  },
  groupMessages: (groupId: string) => `messages:group:${groupId}`,
  groupMessagesPage: (
    groupId: string,
    limit: number,
    before: string | null,
  ) => {
    const suffix = before ? `:before:${before}` : ":latest"
    return `messages:group:${groupId}:limit:${limit}${suffix}`
  },
  conversations: (userId: string) => `conversations:${userId}`,
  statuses: (userId: string) => `statuses:${userId}`,
  userProfile: (userId: string) => `profile:${userId}`,
  lastSeenSingle: (userId: string) => `lastseen:single:${userId}`,
  lastSeenBatch: (userIds: string[]) => {
    const sorted = [...userIds].sort().join(",")
    return `lastseen:batch:${sorted}`
  },
}

export async function invalidateDirectMessages(userId: string, peerId: string) {
  const base = CacheKeys.directMessages(userId, peerId)
  return redisDelPattern(`${base}*`)
}

export async function invalidateGroupMessages(groupId: string) {
  return redisDelPattern(`${CacheKeys.groupMessages(groupId)}*`)
}

export async function invalidateUserConversations(userId: string) {
  return redisDel(CacheKeys.conversations(userId))
}

export async function invalidateUserCache(userId: string, peerIds?: string[], groupIds?: string[]) {
  const tasks: Promise<boolean>[] = []
  tasks.push(invalidateUserConversations(userId))
  if (peerIds) {
    for (const pid of peerIds) {
      tasks.push(invalidateDirectMessages(userId, pid))
    }
  }
  if (groupIds) {
    for (const gid of groupIds) {
      tasks.push(invalidateGroupMessages(gid))
    }
  }
  await Promise.all(tasks)
}

export async function wipeAllUserCache(userId: string) {
  return redisDelPattern(`*${userId}*`)
}
