import crypto from "crypto";
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

const computeSignature = (payload: string): string =>
  crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("hex");

const timingSafeEqual = (a: string, b: string): boolean => {
  try {
    const aBuf = Buffer.from(a, "utf8");
    const bBuf = Buffer.from(b, "utf8");
    if (aBuf.length !== bBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch {
    return false;
  }
};

const encodeSession = <T>(payload: T): string => {
  const payloadJson = JSON.stringify(payload);
  const signature = computeSignature(payloadJson);
  const envelope = JSON.stringify({ payload, sig: signature });
  return Buffer.from(envelope, "utf8").toString("base64url");
};

const decodeSession = <T>(raw?: string): T | null => {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object" || typeof parsed.sig !== "string") {
      return null;
    }
    const payload = (parsed as { payload: unknown }).payload;
    const expectedSig = computeSignature(JSON.stringify(payload));
    if (!timingSafeEqual(parsed.sig, expectedSig)) {
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

export const signUserSession = (session: UserSession): string =>
  encodeSession({ ...session, exp: Date.now() + userSessionCookieOptions.maxAge * 1000 });

export const verifyUserSession = (raw?: string): UserSession | null => {
  const session = decodeSession<UserSession & { exp?: number }>(raw);
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

export const getUserSession = (req: any): UserSession | null => {
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

export const signAdminSession = (session: AdminSession): string =>
  encodeSession({
    ...session,
    createdAt: Date.now(),
    exp: Date.now() + adminSessionCookieOptions.maxAge * 1000,
  });

export const verifyAdminSession = (raw?: string): AdminSession | null => {
  const session = decodeSession<AdminSession & { exp?: number }>(raw);
  if (!session || isSessionExpired(session.exp)) return null;
  if (session.keyLogin) return session;
  if (typeof session.adminId === "string" && session.adminId.trim()) return session;
  return null;
};

export const getAdminSession = (req: any): AdminSession | null => {
  const raw = getCookieValue(req, "admin_session");
  return verifyAdminSession(raw);
};

export interface AdminOtpSessionPayload {
  email: string;
  hash: string;
  salt: string;
  exp: number;
}

export const signOtpSession = (session: OtpSessionPayload): string =>
  encodeSession(session);

export const verifyOtpSession = (raw?: string): OtpSessionPayload | null => {
  const session = decodeSession<OtpSessionPayload>(raw);
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

export const signAdminOtpSession = (
  session: AdminOtpSessionPayload,
): string => encodeSession(session);

export const verifyAdminOtpSession = (
  raw?: string,
): AdminOtpSessionPayload | null => {
  const session = decodeSession<AdminOtpSessionPayload>(raw);
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
