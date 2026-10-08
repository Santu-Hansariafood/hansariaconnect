import { connectDB } from "@/lib/db/db";
import ApiRateLimit from "@/models/apiKey/ApiRateLimit";

const WINDOW_MS = 60_000;
const DEFAULT_REQUEST_LIMIT = 60;
const DEFAULT_MESSAGE_LIMIT = 1_000;

export class RateLimitStoreUnavailableError extends Error {
  constructor() {
    super("API rate-limit storage is unavailable");
    this.name = "RateLimitStoreUnavailableError";
  }
}

export interface ApiRateLimitResult {
  allowed: boolean;
  requestLimit: number;
  messageLimit: number;
  requestsRemaining: number;
  messagesRemaining: number;
  resetAt: number;
  retryAfter: number;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function positiveLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function consumeApiRateLimit(
  apiKeyId: string,
  messageCount: number,
  countRequest = true,
  now = Date.now(),
): Promise<ApiRateLimitResult> {
  if (
    !Number.isSafeInteger(messageCount) ||
    messageCount < 0 ||
    (!countRequest && messageCount === 0)
  ) {
    throw new RangeError("messageCount must be a non-negative safe integer");
  }

  const requestLimit = positiveLimit(
    process.env.API_RATE_LIMIT_REQUESTS_PER_MINUTE,
    DEFAULT_REQUEST_LIMIT,
  );
  const messageLimit = positiveLimit(
    process.env.API_RATE_LIMIT_MESSAGES_PER_MINUTE,
    DEFAULT_MESSAGE_LIMIT,
  );
  const windowStart = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const resetAt = Math.ceil((windowStart + WINDOW_MS) / 1000);
  const retryAfter = Math.max(1, resetAt - Math.floor(now / 1000));
  const bucketId = `${apiKeyId}:${windowStart}`;

  try {
    await connectDB();
    const filter = { _id: bucketId };
    const update = {
      $inc: { requests: countRequest ? 1 : 0, messages: messageCount },
      $setOnInsert: { expiresAt: new Date(windowStart + WINDOW_MS * 2) },
    };
    let bucket;
    try {
      bucket = await ApiRateLimit.findOneAndUpdate(filter, update, {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
      bucket = await ApiRateLimit.findOneAndUpdate(filter, update, {
        new: true,
      });
    }

    if (!bucket) throw new Error("Rate-limit bucket update returned no document");
    const requestsRemaining = Math.max(0, requestLimit - bucket.requests);
    const messagesRemaining = Math.max(0, messageLimit - bucket.messages);

    return {
      allowed:
        bucket.requests <= requestLimit && bucket.messages <= messageLimit,
      requestLimit,
      messageLimit,
      requestsRemaining,
      messagesRemaining,
      resetAt,
      retryAfter,
    };
  } catch {
    throw new RateLimitStoreUnavailableError();
  }
}

export function applyApiRateLimitHeaders(
  headers: Headers,
  result: ApiRateLimitResult,
): void {
  headers.set("X-RateLimit-Request-Limit", String(result.requestLimit));
  headers.set("X-RateLimit-Requests-Remaining", String(result.requestsRemaining));
  headers.set("X-RateLimit-Message-Limit", String(result.messageLimit));
  headers.set("X-RateLimit-Messages-Remaining", String(result.messagesRemaining));
  headers.set("X-RateLimit-Reset", String(result.resetAt));
  if (!result.allowed) headers.set("Retry-After", String(result.retryAfter));
}
