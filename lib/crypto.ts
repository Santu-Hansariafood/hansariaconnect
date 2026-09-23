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
const AUTHENTICATED_ALGORITHM = "aes-256-gcm";
const GCM_IV_LENGTH = 12;
const KEY_LENGTH = 32;
const keyCache = new Map<string, Buffer>();

const deriveKey = (scope: string): Buffer => {
  const cached = keyCache.get(scope);
  if (cached) return cached;

  const secret = getEncryptionSecret();
  const salt = `chat-key:${scope}`;
  const key = pbkdf2Sync(secret, salt, 100000, KEY_LENGTH, "sha256");
  keyCache.set(scope, key);
  return key;
};

const deriveChatKey = (chatId: string): Buffer => deriveKey(chatId);

const deriveGroupKey = (groupId: string): Buffer => {
  return deriveKey(`group:${groupId}`);
};

const encryptAuthenticated = (key: Buffer, plaintext: string): string => {
  const iv = randomBytes(GCM_IV_LENGTH);
  const cipher = createCipheriv(AUTHENTICATED_ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v2:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
};

const decryptAuthenticated = (key: Buffer, ciphertext: string): string | null => {
  const [, ivPart, tagPart, encryptedPart] = ciphertext.split(":");
  if (!ivPart || !tagPart || !encryptedPart) return null;

  const decipher = createDecipheriv(
    AUTHENTICATED_ALGORITHM,
    key,
    Buffer.from(ivPart, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
};

export function encryptDirectMessageContent(
  userAId: string,
  userBId: string,
  plaintext: string,
): string {
  if (!plaintext) return "";
  const sortedIds = [userAId, userBId].sort();
  const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
  return encryptAuthenticated(deriveChatKey(chatId), plaintext);
}

const decryptLegacy = (key: Buffer, ciphertext: string): string => {
  const parts = ciphertext.split(":");
  if (parts.length !== 2) return ciphertext;
  try {
    const iv = Buffer.from(parts[0], "base64");
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(parts[1], "base64", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    return ciphertext;
  }
};

export function decryptDirectMessageContent(
  userAId: string,
  userBId: string,
  ciphertext: string,
): string {
  if (!ciphertext) return "";
  const sortedIds = [userAId, userBId].sort();
  const chatId = `${sortedIds[0]}_${sortedIds[1]}`;
  const key = deriveChatKey(chatId);

  try {
    if (ciphertext.startsWith("v2:")) {
      return decryptAuthenticated(key, ciphertext) ?? "";
    }
    return decryptLegacy(key, ciphertext);
  } catch {
    return "";
  }
}

export function encryptGroupMessageContent(
  groupId: string,
  plaintext: string,
): string {
  if (!plaintext) return "";
  return encryptAuthenticated(deriveGroupKey(groupId), plaintext);
}

export function decryptGroupMessageContent(
  groupId: string,
  ciphertext: string,
): string {
  if (!ciphertext) return "";
  const key = deriveGroupKey(groupId);

  try {
    if (ciphertext.startsWith("v2:")) {
      return decryptAuthenticated(key, ciphertext) ?? "";
    }
    return decryptLegacy(key, ciphertext);
  } catch {
    return "";
  }
}

const cryptoUtils = {
  digestHex,
  pbkdf2Hex,
  hmacSha256Hex,
  randomBytesHex,
  encryptDirectMessageContent,
  decryptDirectMessageContent,
  encryptGroupMessageContent,
  decryptGroupMessageContent,
};

export default cryptoUtils;
