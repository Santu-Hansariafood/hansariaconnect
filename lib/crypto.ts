import "server-only";

import { createHash, createHmac, pbkdf2Sync, randomBytes } from "crypto";

export function digestHex(
  algorithm: "SHA-1" | "SHA-256",
  data: string,
): string {
  const algorithmMap = {
    "SHA-1": "sha1",
    "SHA-256": "sha256",
  } as const;

  return createHash(algorithmMap[algorithm]).update(data, "utf8").digest("hex");
}

export function pbkdf2Hex(
  password: string,
  salt: string,
  iterations: number,
  keyLen: number,
  digest: string,
): string {
  return pbkdf2Sync(password, salt, iterations, keyLen, digest).toString("hex");
}

export function hmacSha256Hex(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

export function randomBytesHex(size: number): string {
  return randomBytes(size).toString("hex");
}

export default {
  digestHex,
  pbkdf2Hex,
  hmacSha256Hex,
  randomBytesHex,
};
