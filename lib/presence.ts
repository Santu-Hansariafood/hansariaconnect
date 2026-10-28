import { getSocketRedisClient } from "@/lib/socketRedisAdapter";

/**
 * Shared presence keys. The Socket.IO server writes them (see
 * `pages/api/socket.ts`) and the Web Push sender reads them, so that a push is
 * only raised when the recipient truly has no live socket anywhere.
 */

export const PRESENCE_TTL_MS = 90_000;
export const PRESENCE_HEARTBEAT_MS = 30_000;

const socketRedisKey =
  process.env.SOCKET_IO_REDIS_KEY || "hansariaconnect:socket.io";

export const onlineUsersKey = `${socketRedisKey}:online-users`;

export const userSocketsKey = (userId: string) =>
  `${socketRedisKey}:user:${userId}:sockets`;

/**
 * Sockets whose page the user can actually see. A socket stays connected while
 * the app is minimised, so connection presence alone cannot tell "the user is
 * looking at the app" from "the app is in the background".
 */
export const activeSocketsKey = (userId: string) =>
  `${socketRedisKey}:user:${userId}:active`;

type LocalConnections = Map<string, number>;

/**
 * Fallback for single-instance deployments without Redis: the socket server
 * keeps the same map on `globalThis`.
 */
const localConnectionCount = (userId: string): number => {
  const connections = (globalThis as typeof globalThis & {
    __userConnections?: LocalConnections;
  }).__userConnections;

  return connections?.get(userId) ?? 0;
};

const localVisibleConnectionCount = (userId: string): number => {
  const connections = (globalThis as typeof globalThis & {
    __visibleConnections?: LocalConnections;
  }).__visibleConnections;

  return connections?.get(userId) ?? 0;
};

/** True while the user has at least one live socket (any tab, any instance). */
export const isUserOnline = async (userId: string): Promise<boolean> => {
  if (!userId) return false;

  try {
    const redis = await getSocketRedisClient();
    if (!redis) return localConnectionCount(userId) > 0;

    const expiresAt = await redis.zscore(onlineUsersKey, userId);
    return expiresAt !== null && Number(expiresAt) > Date.now();
  } catch (error) {
    console.error(
      "[presence] Could not read shared presence:",
      error instanceof Error ? error.message : error,
    );
    return localConnectionCount(userId) > 0;
  }
};

/**
 * True only while one of the user's sockets belongs to a visible page.
 *
 * This is the signal the alert pipeline uses, because it decides *where* an
 * alert has to be delivered: an app the user is looking at alerts in-app, while
 * a minimised or closed one has no visible socket and therefore has to be
 * reached over the internet with a Web Push. An offline user is never actively
 * viewing, which is exactly what makes the closed-app case work too.
 */
export const isUserActivelyViewing = async (
  userId: string,
): Promise<boolean> => {
  if (!userId) return false;

  try {
    const redis = await getSocketRedisClient();
    if (!redis) return localVisibleConnectionCount(userId) > 0;

    const visible = await redis.zcount(
      activeSocketsKey(userId),
      Date.now(),
      "+inf",
    );
    return visible > 0;
  } catch (error) {
    console.error(
      "[presence] Could not read shared visibility:",
      error instanceof Error ? error.message : error,
    );
    return localVisibleConnectionCount(userId) > 0;
  }
};
