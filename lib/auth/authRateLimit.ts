import { createHash } from "node:crypto";
import { connectDB } from "@/lib/db/db";
import ApiRateLimit from "@/models/apiKey/ApiRateLimit";

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

export async function consumeAuthRateLimits(
  action: string,
  policies: AuthRateLimitPolicy[],
  now = Date.now(),
): Promise<AuthRateLimitResult> {
  let allowed = true;
  let retryAfter = 1;

  try {
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
