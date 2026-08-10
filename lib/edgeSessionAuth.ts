import type { NextRequest } from "next/server";

export interface EdgeAdminSession {
  adminId?: string;
  userId?: string;
  email?: string;
  isSuperAdmin?: boolean;
  keyLogin?: boolean;
  createdAt?: number;
  exp?: number;
}

export interface EdgeUserSession {
  id: string;
  sessionId: string;
  mobile?: string;
  exp?: number;
}

const textEncoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array): string {
  let result = "";

  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }

  return result;
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(key),
    {
      name: "HMAC",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    textEncoder.encode(message),
  );

  return bytesToHex(new Uint8Array(signature));
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET or NEXTAUTH_SECRET must be configured");
  }

  return secret;
}

function getCookieValue(req: NextRequest, name: string): string | undefined {
  return req.cookies.get(name)?.value;
}

async function decodeSession<T>(raw: string | undefined): Promise<T | null> {
  if (!raw) {
    return null;
  }

  try {
    const decodedBytes = base64UrlToUint8Array(raw);

    const decoded = new TextDecoder().decode(decodedBytes);

    const parsed = JSON.parse(decoded);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.sig !== "string"
    ) {
      return null;
    }

    const payload = parsed.payload;

    const payloadJson = JSON.stringify(payload);

    const expectedSignature = await hmacSha256Hex(
      getSessionSecret(),
      payloadJson,
    );

    if (!constantTimeCompare(parsed.sig, expectedSignature)) {
      return null;
    }

    return payload as T;
  } catch {
    return null;
  }
}

export async function getAdminSession(
  req: NextRequest,
): Promise<EdgeAdminSession | null> {
  const raw = getCookieValue(req, "admin_session");

  const session = await decodeSession<EdgeAdminSession>(raw);

  if (!session) {
    return null;
  }

  if (typeof session.exp !== "number" || Date.now() > session.exp) {
    return null;
  }

  if (session.keyLogin) {
    return session;
  }

  if (typeof session.adminId === "string" && session.adminId.trim()) {
    return session;
  }

  return null;
}

export async function getUserSession(
  req: NextRequest,
): Promise<EdgeUserSession | null> {
  const raw = getCookieValue(req, "user_session");

  const session = await decodeSession<EdgeUserSession>(raw);

  if (!session) {
    return null;
  }

  if (typeof session.exp !== "number" || Date.now() > session.exp) {
    return null;
  }

  if (
    typeof session.id === "string" &&
    session.id.trim() &&
    typeof session.sessionId === "string" &&
    session.sessionId.trim()
  ) {
    return session;
  }

  return null;
}
