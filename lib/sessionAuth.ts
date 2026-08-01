import { hmacSha256Hex, digestHex, randomBytesHex } from "./crypto";
import { parseCookie } from "cookie";
import type { NextRequest } from "next/server";
import { connectDB } from "./db/db";
import User from "@/models/user/User";

export interface UserSession {
  id: string;
  sessionId: string;
  mobile?: string;
}

export interface UserSessionRecord {
  sessionId: string;
  createdAt: number;
  userAgent?: string;
  ip?: string;
}

const MAX_DEVICE_SESSIONS = Number(process.env.MAX_DEVICE_SESSIONS) || 4;

export interface AdminSession {
  adminId?: string;
  userId?: string;
  email?: string;
  isSuperAdmin?: boolean;
  keyLogin?: boolean;
  createdAt?: number;
}

const getSessionSecret = (): string => {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET or NEXTAUTH_SECRET must be configured");
  }
  return secret;
};

const computeSignature = async (payload: string): Promise<string> =>
  await hmacSha256Hex(getSessionSecret(), payload);

const constantTimeCompare = (a: string, b: string): boolean => {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const encodeSession = async <T>(payload: T): Promise<string> => {
  const payloadJson = JSON.stringify(payload);
  const signature = await computeSignature(payloadJson);
  const envelope = JSON.stringify({ payload, sig: signature });
  return Buffer.from(envelope, "utf8").toString("base64url");
};

const decodeSession = async <T>(raw?: string): Promise<T | null> => {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || typeof parsed.sig !== "string") {
      return null;
    }
    const payload = (parsed as { payload: unknown }).payload;
    const expectedSig = await computeSignature(JSON.stringify(payload));
    if (!constantTimeCompare(parsed.sig, expectedSig)) {
      return null;
    }
    return payload as T;
  } catch {
    return null;
  }
};

const getCookieValue = (req: any, name: string): string | undefined => {
  if (req?.cookies) {
    if (typeof req.cookies.get === "function") {
      return req.cookies.get(name)?.value;
    }
    if (typeof req.cookies[name] === "string") {
      return req.cookies[name];
    }
  }

  const cookieHeader =
    typeof req?.headers?.get === "function"
      ? req.headers.get("cookie")
      : req?.headers?.cookie;

  if (typeof cookieHeader === "string") {
    return parseCookie(cookieHeader)[name];
  }

  return undefined;
};

export interface OtpSessionPayload {
  mobile: string;
  hash: string;
  salt: string;
  exp: number;
}

export const userSessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/" as const,
  maxAge: 30 * 24 * 60 * 60,
};

export const adminSessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/" as const,
  maxAge: 30 * 24 * 60 * 60,
};

export const authOtpCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/" as const,
  maxAge: 5 * 60,
};

const isSessionExpired = (exp?: unknown): exp is number =>
  typeof exp === "number" && Date.now() > exp;

export const signUserSession = async (session: UserSession): Promise<string> =>
  encodeSession({ ...session, exp: Date.now() + userSessionCookieOptions.maxAge * 1000 });

export const verifyUserSession = async (raw?: string): Promise<UserSession | null> => {
  const session = await decodeSession<UserSession & { exp?: number }>(raw);
  if (
    !session ||
    typeof session.id !== "string" ||
    typeof session.sessionId !== "string" ||
    isSessionExpired(session.exp)
  ) {
    return null;
  }
  return {
    id: session.id,
    sessionId: session.sessionId,
    mobile: typeof session.mobile === "string" ? session.mobile : undefined,
  };
};

export const getUserSession = async (req: any): Promise<UserSession | null> => {
  const raw = getCookieValue(req, "user_session");
  return verifyUserSession(raw);
};

export const addUserSession = async (
  userId: string,
  sessionId: string,
  userAgent?: string,
  ip?: string,
): Promise<boolean> => {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) return false;

  const maxAgeMs = userSessionCookieOptions.maxAge * 1000;
  const activeSessions = (user.sessions || []).filter(
    (session: UserSessionRecord) =>
      typeof session.createdAt === "number" &&
      Date.now() - session.createdAt < maxAgeMs,
  );

  if (activeSessions.length >= MAX_DEVICE_SESSIONS) {
    return false;
  }

  activeSessions.push({ sessionId, createdAt: Date.now(), userAgent, ip });
  user.sessions = activeSessions as any;
  await user.save();
  return true;
};

export const removeUserSession = async (
  userId: string,
  sessionId: string,
): Promise<void> => {
  await connectDB();
  await User.findByIdAndUpdate(userId, {
    $pull: { sessions: { sessionId } },
  });
};

export const signAdminSession = async (session: AdminSession): Promise<string> =>
  encodeSession({
    ...session,
    createdAt: Date.now(),
    exp: Date.now() + adminSessionCookieOptions.maxAge * 1000,
  });

export const verifyAdminSession = async (raw?: string): Promise<AdminSession | null> => {
  const session = await decodeSession<AdminSession & { exp?: number }>(raw);
  if (!session || isSessionExpired(session.exp)) return null;
  if (session.keyLogin) return session;
  if (typeof session.adminId === "string" && session.adminId.trim()) return session;
  return null;
};

export const getAdminSession = async (req: any): Promise<AdminSession | null> => {
  const raw = getCookieValue(req, "admin_session");
  return verifyAdminSession(raw);
};

export interface AdminOtpSessionPayload {
  email: string;
  hash: string;
  salt: string;
  exp: number;
}

export const signOtpSession = async (session: OtpSessionPayload): Promise<string> =>
  encodeSession(session);

export const verifyOtpSession = async (raw?: string): Promise<OtpSessionPayload | null> => {
  const session = await decodeSession<OtpSessionPayload>(raw);
  if (
    !session ||
    typeof session.mobile !== "string" ||
    typeof session.hash !== "string" ||
    typeof session.salt !== "string" ||
    isSessionExpired(session.exp)
  ) {
    return null;
  }
  return session;
};

export const signAdminOtpSession = async (
  session: AdminOtpSessionPayload,
): Promise<string> => encodeSession(session);

export const verifyAdminOtpSession = async (
  raw?: string,
): Promise<AdminOtpSessionPayload | null> => {
  const session = await decodeSession<AdminOtpSessionPayload>(raw);
  if (
    !session ||
    typeof session.email !== "string" ||
    typeof session.hash !== "string" ||
    typeof session.salt !== "string" ||
    isSessionExpired(session.exp)
  ) {
    return null;
  }
  return session;
};
