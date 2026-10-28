import { hmacSha256Hex } from "./crypto";
import { parseCookie } from "cookie";
import { connectDB } from "./db/db";
import User from "@/models/user/User";
import type { IUserSessionRecord } from "@/models/user/User";
import { MAX_DEVICE_SESSIONS } from "./auth/deviceLimits";

export interface UserSession {
  id: string;
  sessionId: string;
  mobile?: string;
}

export interface UserSessionRecord {
  sessionId: string;
  createdAt: number;
  lastActivityAt?: number;
  userAgent?: string;
  browserName?: string;
  deviceName?: string;
  ip?: string;
}

export interface DeviceMetadata {
  userAgent?: string;
  browserName?: string;
  deviceName?: string;
  ip?: string;
}

const getClientIp = (req: { headers?: { get?: (name: string) => string | null } }): string | undefined => {
  const forwarded = req.headers?.get?.("x-forwarded-for") || "";
  return (forwarded.split(",")[0]?.trim() || req.headers?.get?.("x-real-ip") || undefined);
};

export const getDeviceMetadata = (req: { headers?: { get?: (name: string) => string | null } }): DeviceMetadata => {
  const userAgent = req.headers?.get?.("user-agent") || "";
  const browserName = /Edg\//i.test(userAgent)
    ? "Microsoft Edge"
    : /Chrome\//i.test(userAgent)
      ? "Google Chrome"
      : /Firefox\//i.test(userAgent)
        ? "Mozilla Firefox"
        : /Safari\//i.test(userAgent)
          ? "Safari"
          : "Unknown browser";
  const deviceName = /mobile|android|iphone|ipad/i.test(userAgent)
    ? "Mobile device"
    : "Desktop device";

  return { userAgent, browserName, deviceName, ip: getClientIp(req) };
};

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
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.sig !== "string"
    ) {
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

type SessionRequestLike = {
  cookies?: { get?: (name: string) => { value?: string } | undefined } | Record<string, unknown>;
  headers?: {
    get?: (name: string) => string | null;
    cookie?: unknown;
  };
};

const getCookieValue = (req: unknown, name: string): string | undefined => {
  if (!req || typeof req !== "object") return undefined;
  const request = req as SessionRequestLike;
  const cookies = request.cookies;
  if (cookies) {
    if ("get" in cookies && typeof cookies.get === "function") {
      return cookies.get(name)?.value;
    }
    const value = (cookies as Record<string, unknown>)[name];
    if (typeof value === "string") {
      return value;
    }
  }

  const cookieHeader =
    typeof request.headers?.get === "function"
      ? request.headers.get("cookie")
      : request.headers?.cookie;

  if (typeof cookieHeader === "string") {
    return parseCookie(cookieHeader)[name];
  }

  return undefined;
};

export interface OtpSessionPayload {
  challengeId: string;
  exp: number;
}

export const userSessionCookieOptions = {
  httpOnly: true as const,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/" as const,
  maxAge: 365 * 24 * 60 * 60,
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

const isSessionExpired = (exp?: unknown): boolean =>
  typeof exp !== "number" || !Number.isFinite(exp) || Date.now() >= exp;

export const signUserSession = async (session: UserSession): Promise<string> =>
  encodeSession({
    ...session,
    exp: Date.now() + userSessionCookieOptions.maxAge * 1000,
  });

export const verifyUserSession = async (
  raw?: string,
): Promise<UserSession | null> => {
  const session = await decodeSession<UserSession & { exp?: number }>(raw);
  if (
    !session ||
    typeof session.id !== "string" ||
    !/^[a-f0-9]{24}$/i.test(session.id) ||
    typeof session.sessionId !== "string" ||
    !/^[a-f0-9]{32}$/i.test(session.sessionId) ||
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

export const getUserSession = async (req: unknown): Promise<UserSession | null> => {
  const raw = getCookieValue(req, "user_session");
  const session = await verifyUserSession(raw);
  if (!session) return null;

  await connectDB();
  const activeSession = await User.exists({
    _id: session.id,
    sessions: {
      $elemMatch: {
        sessionId: session.sessionId,
        $or: [
          {
            lastActivityAt: {
              $gt: Date.now() - userSessionCookieOptions.maxAge * 1000,
            },
          },
          {
            lastActivityAt: { $exists: false },
            createdAt: {
              $gt: Date.now() - userSessionCookieOptions.maxAge * 1000,
            },
          },
        ],
      },
    },
  });
  return activeSession ? session : null;
};

export const addUserSession = async (
  userId: string,
  sessionId: string,
  userAgentOrMetadata?: string | DeviceMetadata,
  ip?: string,
): Promise<boolean> => {
  await connectDB();
  const metadata: DeviceMetadata = typeof userAgentOrMetadata === "string"
    ? { userAgent: userAgentOrMetadata, ip }
    : userAgentOrMetadata || {};
  const now = Date.now();
  const cutoff = now - userSessionCookieOptions.maxAge * 1000;
  await User.updateOne(
    { _id: userId },
    {
      $pull: {
        sessions: {
          $or: [
            { lastActivityAt: { $lte: cutoff } },
            {
              lastActivityAt: { $exists: false },
              createdAt: { $lte: cutoff },
            },
          ],
        },
      },
    },
  );
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lt: [
          {
            $size: {
              $filter: {
                input: { $ifNull: ["$sessions", []] },
                as: "session",
                cond: {
                  $gt: [
                    {
                      $ifNull: [
                        "$$session.lastActivityAt",
                        "$$session.createdAt",
                      ],
                    },
                    cutoff,
                  ],
                },
              },
            },
          },
          MAX_DEVICE_SESSIONS,
        ],
      },
    },
    {
      $push: {
        sessions: {
          sessionId,
          createdAt: now,
          lastActivityAt: now,
          ...metadata,
        },
      },
    },
    { new: true },
  );
  return Boolean(updatedUser);
};

export const replaceUserSessions = async (
  userId: string,
  sessionId: string,
  userAgentOrMetadata?: string | DeviceMetadata,
  ip?: string,
): Promise<string[]> => {
  await connectDB();
  const metadata: DeviceMetadata = typeof userAgentOrMetadata === "string"
    ? { userAgent: userAgentOrMetadata, ip }
    : userAgentOrMetadata || {};
  const now = Date.now();
  const existingUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        sessions: [{ sessionId, createdAt: now, lastActivityAt: now, ...metadata }],
      },
    },
    { new: false },
  )
    .select("sessions")
    .lean();

  const existingSessions = (existingUser?.sessions ||
    []) as IUserSessionRecord[];
  return existingSessions
    .map((session) => session.sessionId)
    .filter((existingSessionId) => existingSessionId !== sessionId);
};

export const removeUserSession = async (
  userId: string,
  sessionId: string,
): Promise<boolean> => {
  await connectDB();
  const result = await User.updateOne(
    { _id: userId },
    { $pull: { sessions: { sessionId } } },
  );
  return result.modifiedCount > 0;
};

export const signAdminSession = async (
  session: AdminSession,
): Promise<string> =>
  encodeSession({
    ...session,
    createdAt: Date.now(),
    exp: Date.now() + adminSessionCookieOptions.maxAge * 1000,
  });

export const verifyAdminSession = async (
  raw?: string,
): Promise<AdminSession | null> => {
  const session = await decodeSession<AdminSession & { exp?: number }>(raw);
  if (!session || isSessionExpired(session.exp)) return null;
  if (session.keyLogin) return session;
  if (typeof session.adminId === "string" && session.adminId.trim())
    return session;
  return null;
};

export const getAdminSession = async (
  req: unknown,
): Promise<AdminSession | null> => {
  const raw = getCookieValue(req, "admin_session");
  return verifyAdminSession(raw);
};

export interface AdminOtpSessionPayload {
  challengeId: string;
  exp: number;
}

export const signOtpSession = async (
  session: OtpSessionPayload,
): Promise<string> => encodeSession(session);

export const verifyOtpSession = async (
  raw?: string,
): Promise<OtpSessionPayload | null> => {
  const session = await decodeSession<OtpSessionPayload>(raw);
  if (
    !session ||
    typeof session.challengeId !== "string" ||
    !/^[a-f0-9]{32}$/i.test(session.challengeId) ||
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
    typeof session.challengeId !== "string" ||
    !/^[a-f0-9]{32}$/i.test(session.challengeId) ||
    isSessionExpired(session.exp)
  ) {
    return null;
  }
  return session;
};
