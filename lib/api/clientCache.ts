"use client";

/*
 * A tiny client-side request cache for GET calls.
 *
 * The app has several screens that need the same data at the same moment
 * (conversations, unread counts and settings are each requested from more than
 * one hook on boot), plus a few small polling loops as safety nets. Without a
 * shared layer every one of those became its own network round-trip.
 *
 * `cachedFetch` collapses concurrent identical requests into one (single-flight)
 * and serves a short-lived cached copy for later callers, so a burst becomes a
 * single request. Correctness is preserved by keeping TTLs short and letting
 * callers call `invalidateApiCache` when they know the data changed (a message
 * arrived, a read receipt landed, settings were saved).
 */

export const ApiCacheTTL = {
  /** Data that is pushed live over the socket — only collapse bursts. */
  realtime: 3_000,
  /** List/preview data that can lag a few seconds behind the socket. */
  short: 5_000,
  /** Slowly changing feeds. */
  medium: 15_000,
  /** Rarely changing per-user config. */
  long: 60_000,
} as const;

const DEFAULT_TTL_MS = ApiCacheTTL.short;

type CacheEntry = {
  data: unknown;
  expiresAt: number;
};

type FetchResult = {
  ok: boolean;
  status: number;
  data: unknown;
};

const cacheStore = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<FetchResult>>();

export interface CachedFetchInit extends RequestInit {
  /** How long a successful response stays fresh, in ms. `0` disables caching. */
  ttlMs?: number;
  /** Bypass the cache and always revalidate (concurrent calls still de-dupe). */
  force?: boolean;
}

const isCacheable = (init: CachedFetchInit): boolean => {
  const method = (init.method || "GET").toUpperCase();
  return method === "GET" && !init.body;
};

const buildResponse = (result: FetchResult): Response =>
  new Response(result.data == null ? null : JSON.stringify(result.data), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });

/**
 * Drop-in replacement for `fetch` that de-dupes and briefly caches GET calls.
 * Non-GET calls (or `ttlMs: 0`) pass straight through to the network.
 */
export async function cachedFetch(
  input: string,
  init: CachedFetchInit = {},
): Promise<Response> {
  const { ttlMs = DEFAULT_TTL_MS, force = false, ...requestInit } = init;

  if (!isCacheable(init) || ttlMs <= 0) {
    return fetch(input, requestInit);
  }

  const key = `GET ${input}`;

  if (!force) {
    const entry = cacheStore.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return buildResponse({ ok: true, status: 200, data: entry.data });
    }
  }

  const pending = inflightRequests.get(key);
  if (pending) {
    return buildResponse(await pending);
  }

  const request = (async (): Promise<FetchResult> => {
    const response = await fetch(input, requestInit);
    const data = await response.json().catch(() => null);
    if (response.ok) {
      cacheStore.set(key, { data, expiresAt: Date.now() + ttlMs });
    }
    return { ok: response.ok, status: response.status, data };
  })();

  inflightRequests.set(key, request);

  try {
    return buildResponse(await request);
  } finally {
    inflightRequests.delete(key);
  }
}

/**
 * The single entry point for clearing cached GET data.
 * Pass a URL fragment / pattern to drop matching entries, or nothing to clear all.
 */
export function invalidateApiCache(match?: string | RegExp): void {
  if (!match) {
    cacheStore.clear();
    inflightRequests.clear();
    return;
  }

  for (const key of Array.from(cacheStore.keys())) {
    const hit = typeof match === "string" ? key.includes(match) : match.test(key);
    if (hit) cacheStore.delete(key);
  }
}

/** Seed the cache with a value already in hand (e.g. the bootstrap payload). */
export function primeApiCache(
  input: string,
  data: unknown,
  ttlMs: number = DEFAULT_TTL_MS,
): void {
  cacheStore.set(`GET ${input}`, { data, expiresAt: Date.now() + ttlMs });
}
