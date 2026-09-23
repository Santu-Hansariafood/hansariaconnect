import { connectDB } from "./db/db";
import ApiKey, { IApiKey } from "@/models/apiKey/ApiKey";
import { pbkdf2Hex } from "./crypto";
import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";

export async function validateApiKey(
  req: NextRequest,
  requiredPermission?: keyof IApiKey["permissions"],
) {
  await connectDB();

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid authorization header", status: 401 };
  }

  const rawKey = authHeader.slice("Bearer ".length);
  const apiKeys = await ApiKey.find({ isActive: true });

  for (const key of apiKeys) {
    const [salt, storedHash] = key.key.split(".");
    if (!salt || !storedHash) continue;

    const hash = await pbkdf2Hex(rawKey, salt, 100000, 64, "SHA-512");

    const matches = hash.length === storedHash.length && timingSafeEqual(
      Buffer.from(hash, "hex"),
      Buffer.from(storedHash, "hex"),
    );

    if (matches) {
      if (key.expiresAt && new Date() > key.expiresAt) {
        return { error: "API key has expired", status: 401 };
      }

      if (requiredPermission && !key.permissions[requiredPermission]) {
        return { error: "API key does not have permission", status: 403 };
      }

      void key.updateOne({ $set: { lastUsed: new Date() } });

      return { apiKey: key };
    }
  }

  return { error: "Invalid API key", status: 401 };
}
