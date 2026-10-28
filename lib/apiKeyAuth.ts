import { connectDB } from "./db/db";
import ApiKey, { IApiKey } from "@/models/apiKey/ApiKey";
import { pbkdf2 as pbkdf2Callback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { digestHex } from "./crypto";
import { NextRequest } from "next/server";

const pbkdf2 = promisify(pbkdf2Callback);
const LAST_USED_WRITE_INTERVAL_MS = 60_000;
const lastUsedWriteAt = new Map<string, number>();

const matchesStoredHash = async (
  storedKey: string,
  rawKey: string,
): Promise<boolean> => {
  const [salt, storedHash] = storedKey.split(".");
  if (!salt || !storedHash) return false;

  const hash = (
    await pbkdf2(rawKey, salt, 100000, 64, "sha512")
  ).toString("hex");

  return (
    hash.length === storedHash.length &&
    timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(storedHash, "hex"),
    )
  );
};

function recordApiKeyUse(apiKey: IApiKey): void {
  const keyId = String(apiKey._id);
  const now = Date.now();
  const previousWrite = lastUsedWriteAt.get(keyId);
  if (previousWrite && now - previousWrite < LAST_USED_WRITE_INTERVAL_MS) {
    return;
  }

  lastUsedWriteAt.set(keyId, now);
  if (lastUsedWriteAt.size > 1000) {
    for (const [id, writtenAt] of lastUsedWriteAt) {
      if (now - writtenAt >= LAST_USED_WRITE_INTERVAL_MS) {
        lastUsedWriteAt.delete(id);
      }
    }
  }

  void ApiKey.updateOne(
    { _id: apiKey._id },
    { $set: { lastUsed: new Date(now) } },
  ).catch((error: unknown) => {
    if (lastUsedWriteAt.get(keyId) === now) {
      lastUsedWriteAt.delete(keyId);
    }
    console.warn(
      "[apiKeyAuth] Could not update API key last-used time:",
      error instanceof Error ? error.message : String(error),
    );
  });
}

type ApiKeyAuthResult =
  | { error: string; status: number }
  | { apiKey: IApiKey };

export async function validateApiKey(
  req: NextRequest,
  requiredPermission?: keyof IApiKey["permissions"],
): Promise<ApiKeyAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid authorization header", status: 401 };
  }

  await connectDB();

  const rawKey = authHeader.slice("Bearer ".length);
  const keyLookup = digestHex("SHA-256", rawKey);
  let matchedKey: IApiKey | null = null;

  // Single indexed lookup instead of running PBKDF2 against every active key.
  const indexedKey = await ApiKey.findOne({ keyLookup, isActive: true });
  if (indexedKey && (await matchesStoredHash(indexedKey.key, rawKey))) {
    matchedKey = indexedKey;
  }

  if (!matchedKey) {
    // Keys created before keyLookup existed are migrated the first time they work.
    const legacyKeys = await ApiKey.find({
      isActive: true,
      keyLookup: { $exists: false },
    });
    for (const candidate of legacyKeys) {
      if (await matchesStoredHash(candidate.key, rawKey)) {
        await ApiKey.updateOne(
          { _id: candidate._id },
          { $set: { keyLookup } },
        );
        matchedKey = candidate;
        break;
      }
    }
  }

  if (!matchedKey) {
    return { error: "Invalid API key", status: 401 };
  }

  if (matchedKey.expiresAt && new Date() > matchedKey.expiresAt) {
    return { error: "API key has expired", status: 401 };
  }

  if (requiredPermission && !matchedKey.permissions[requiredPermission]) {
    return { error: "API key does not have permission", status: 403 };
  }

  recordApiKeyUse(matchedKey);

  return { apiKey: matchedKey };
}
