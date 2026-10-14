import Redis from "ioredis";

import { getRedis } from "@/lib/redis/redis";

export type UnreadPayload = {
  total: number;
  conversations: Record<string, number>;
  groups: Record<string, number>;
};

const TTL_SECONDS = 60 * 60 * 24 * 7;
const INIT_FIELD = "_init";

const key = (userId: string) => `unread:${userId}`;

const INCR_LUA = `
if redis.call('HEXISTS', KEYS[1], '_init') == 1 then
  local v = redis.call('HINCRBY', KEYS[1], ARGV[1], 1)
  redis.call('EXPIRE', KEYS[1], ARGV[2])
  return v
end
return 0`;

const withRedis = async <T>(
  action: (client: Redis) => Promise<T>,
): Promise<T | null> => {
  const client = await getRedis();
  if (!client) return null;
  return action(client);
};

export const incrDirectUnread = async (
  userId: string,
  peerId: string,
): Promise<void> => {
  const result = await withRedis((client) =>
    client.eval(INCR_LUA, 1, key(userId), `c:${peerId}`, TTL_SECONDS),
  );
  if (result === null) return;
};

export const incrGroupUnread = async (
  userId: string,
  groupId: string,
): Promise<void> => {
  const result = await withRedis((client) =>
    client.eval(INCR_LUA, 1, key(userId), `g:${groupId}`, TTL_SECONDS),
  );
  if (result === null) return;
};

export const clearChatUnread = async (
  userId: string,
  field: string,
): Promise<void> => {
  await withRedis((client) => client.hdel(key(userId), field));
};

export const clearAllUnread = async (userId: string): Promise<void> => {
  await withRedis((client) => client.del(key(userId)));
};

export const readUnread = async (
  userId: string,
): Promise<UnreadPayload | null> => {
  const hash = await withRedis((client) => client.hgetall(key(userId)));

  if (!hash || !hash[INIT_FIELD]) return null;

  const conversations: Record<string, number> = {};
  const groups: Record<string, number> = {};
  let total = 0;

  for (const [field, value] of Object.entries(hash)) {
    if (field === INIT_FIELD) continue;

    const count = Number(value);
    if (!Number.isFinite(count) || count <= 0) continue;

    if (field.startsWith("c:")) {
      conversations[field.slice(2)] = count;
      total += count;
    } else if (field.startsWith("g:")) {
      groups[field.slice(2)] = count;
      total += count;
    }
  }

  return { total, conversations, groups };
};

export const writeUnread = async (
  userId: string,
  payload: UnreadPayload,
): Promise<void> => {
  const flat: Record<string, string | number> = { [INIT_FIELD]: 1 };

  for (const [id, count] of Object.entries(payload.conversations)) {
    flat[`c:${id}`] = count;
  }
  for (const [id, count] of Object.entries(payload.groups)) {
    flat[`g:${id}`] = count;
  }

  await withRedis((client) =>
    client
      .multi()
      .del(key(userId))
      .hset(key(userId), flat)
      .expire(key(userId), TTL_SECONDS)
      .exec(),
  );
};
