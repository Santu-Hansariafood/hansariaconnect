import "server-only";

import {
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

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

const getEncryptionSecret = (): string => {
  const secret =
    process.env.ENCRYPTION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "ENCRYPTION_SECRET, SESSION_SECRET, or NEXTAUTH_SECRET must be configured",
    );
  }
  return secret;
};

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;
const KEY_LENGTH = 32;

const deriveChatKey = (chatId: string): Buffer => {
  const secret = getEncryptionSecret();
  const salt = `chat-key:${chatId}`;
  const key = pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, "sha256");
  return key;
};

const deriveGroupKey = (groupId: string): Buffer => {
  const secret = getEncryptionSecret();
  const salt = `group-key:${groupId}`;
  const key = pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, "sha256");
  return key;
};

export function encryptDirectMessageContent(
  userAId: string,
  userBId: string,
  plaintext: string,
): string {
  if (!plaintext) return "";
  const sortedIds = [userAId, userBId].sort();
  const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
  const key = deriveChatKey(chatId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return `${iv.toString("base64")}:${encrypted}`;
}

export function decryptDirectMessageContent(
  userAId: string,
  userBId: string,
  ciphertext: string,
): string {
  if (!ciphertext) return "";
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 2) return ciphertext;
    const sortedIds = [userAId, userBId].sort();
    const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
    const key = deriveChatKey(chatId);
    const iv = Buffer.from(parts[0], "base64");
    const encrypted = parts[1];
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return ciphertext;
  }
}

export function encryptGroupMessageContent(
  groupId: string,
  plaintext: string,
): string {
  if (!plaintext) return "";
  const key = deriveGroupKey(groupId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return `${iv.toString("base64")}:${encrypted}`;
}

export function decryptGroupMessageContent(
  groupId: string,
  ciphertext: string,
): string {
  if (!ciphertext) return "";
  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 2) return ciphertext;
    const key = deriveGroupKey(groupId);
    const iv = Buffer.from(parts[0], "base64");
    const encrypted = parts[1];
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return ciphertext;
  }
}

export default {
  digestHex,
  pbkdf2Hex,
  hmacSha256Hex,
  randomBytesHex,
  encryptDirectMessageContent,
  decryptDirectMessageContent,
  encryptGroupMessageContent,
  decryptGroupMessageContent,
};
