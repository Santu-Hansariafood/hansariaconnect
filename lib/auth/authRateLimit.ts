import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/db";
import ApiRateLimit from "@/models/apiKey/ApiRateLimit";
import { getRedis, isRedisEnabled } from "@/lib/redis/redis";

export interface AuthRateLimitPolicy {
  scope: string;
  limit: number;
  windowSeconds: number;
}

export interface AuthRateLimitResult {
  allowed: boolean;
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

const CONSUME_AUTH_RATE_LIMITS_LUA = `
local allowed = 1
local retryAfter = 1
for i = 1, #KEYS do
  local offset = (i - 1) * 3
  local limit = tonumber(ARGV[offset + 1])
  local ttl = tonumber(ARGV[offset + 2])
  local policyRetryAfter = tonumber(ARGV[offset + 3])
  local requests = redis.call('INCR', KEYS[i])
  if requests == 1 then
    redis.call('PEXPIRE', KEYS[i], ttl)
  end
  if requests > limit then
    allowed = 0
    if policyRetryAfter > retryAfter then
      retryAfter = policyRetryAfter
    end
  end
end
return { allowed, retryAfter }
`;

export async function consumeAuthRateLimits(
  action: string,
  policies: AuthRateLimitPolicy[],
  now = Date.now(),
): Promise<AuthRateLimitResult> {
  let allowed = true;
  let retryAfter = 1;

  try {
    if (isRedisEnabled()) {
      const redis = await getRedis();
      if (!redis) {
        throw new Error("Configured Redis is unavailable for auth rate limiting");
      }

      const keys: string[] = [];
      const args: number[] = [];
      for (const policy of policies) {
        const windowMs = policy.windowSeconds * 1000;
        const windowStart = Math.floor(now / windowMs) * windowMs;
        const scopeHash = createHash("sha256")
          .update(policy.scope)
          .digest("hex");
        keys.push(`auth:rate:${action}:${scopeHash}:${windowStart}`);
        args.push(
          policy.limit,
          windowMs * 2,
          Math.max(
            1,
            Math.ceil((windowStart + windowMs - now) / 1000),
          ),
        );
      }

      const result: unknown = await redis.eval(
        CONSUME_AUTH_RATE_LIMITS_LUA,
        keys.length,
        ...keys,
        ...args,
      );
      if (
        !Array.isArray(result) ||
        typeof result[0] !== "number" ||
        typeof result[1] !== "number"
      ) {
        throw new Error("Redis returned an invalid auth rate-limit result");
      }

      return {
        allowed: result[0] === 1,
        retryAfter: Math.max(1, result[1]),
      };
    }

    await connectDB();

    for (const policy of policies) {
      const windowMs = policy.windowSeconds * 1000;
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const scopeHash = createHash("sha256")
        .update(policy.scope)
        .digest("hex");
      const bucketId = `auth:${action}:${scopeHash}:${windowStart}`;
      const update = {
        $inc: { requests: 1 },
        $setOnInsert: {
          expiresAt: new Date(windowStart + windowMs * 2),
        },
      };

      let bucket;
      try {
        bucket = await ApiRateLimit.findOneAndUpdate(
          { _id: bucketId },
          update,
          { new: true, upsert: true, setDefaultsOnInsert: true },
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        bucket = await ApiRateLimit.findOneAndUpdate(
          { _id: bucketId },
          { $inc: { requests: 1 } },
          { new: true },
        );
      }

      if (!bucket) throw new Error("Auth rate-limit update returned no bucket");
      if (bucket.requests > policy.limit) {
        allowed = false;
        retryAfter = Math.max(
          retryAfter,
          Math.ceil((windowStart + windowMs - now) / 1000),
        );
      }
    }
  } catch (error) {
    console.error("Authentication rate-limit storage failed:", error);
    throw new Error("Authentication is temporarily unavailable");
  }

  return { allowed, retryAfter };
}

export function getAuthRateLimitScopes(
  req: { headers: Headers },
  target: string,
): { ip: string; target: string } {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return { ip: `ip:${ip}`, target: `target:${target}` };
}
