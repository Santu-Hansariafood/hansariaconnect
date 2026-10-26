import { connectDB } from "./db/db";
import ApiKey, { IApiKey } from "@/models/apiKey/ApiKey";
import { digestHex, pbkdf2Hex } from "./crypto";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

const matchesStoredHash = async (
  storedKey: string,
  rawKey: string,
): Promise<boolean> => {
  const [salt, storedHash] = storedKey.split(".");
  if (!salt || !storedHash) return false;

  const hash = await pbkdf2Hex(rawKey, salt, 100000, 64, "SHA-512");

  return (
    hash.length === storedHash.length &&
    timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(storedHash, "hex"),
    )
  );
};

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

  void matchedKey.updateOne({ $set: { lastUsed: new Date() } });

  return { apiKey: matchedKey };
}
