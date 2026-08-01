import { connectDB } from "./db/db";
import ApiKey, { IApiKey } from "@/models/apiKey/ApiKey";
import { pbkdf2Hex } from "./crypto";
import { NextRequest } from "next/server";

export async function validateApiKey(req: NextRequest, requiredPermission?: keyof IApiKey["permissions"]) {
  await connectDB();

  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { error: "Missing or invalid authorization header", status: 401 };
  }

  const rawKey = authHeader.slice("Bearer ".length);
  const apiKeys = await ApiKey.find({ isActive: true });

  for (const key of apiKeys) {
    // Key is stored as "salt.hash"
    const [salt, storedHash] = key.key.split(".");
    if (!salt || !storedHash) continue;

    const hash = await pbkdf2Hex(rawKey, salt, 100000, 64, "SHA-512");

    if (hash === storedHash) {
      // Check expiration
      if (key.expiresAt && new Date() > key.expiresAt) {
        return { error: "API key has expired", status: 401 };
      }

      // Check permissions
      if (requiredPermission && !key.permissions[requiredPermission]) {
        return { error: "API key does not have permission", status: 403 };
      }

      // Update last used
      key.lastUsed = new Date();
      await key.save();

      return { apiKey: key };
    }
  }

  return { error: "Invalid API key", status: 401 };
}
