import { hmacSha256Hex, randomBytesHex } from "@/lib/crypto";
import type { UserSession } from "@/lib/sessionAuth";

const STATE_LIFETIME_MS = 10 * 60 * 1000;

type GoogleOAuthStatePayload = {
  session: UserSession;
  nonce: string;
  expiresAt: number;
};

const getSigningSecret = () => {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET or NEXTAUTH_SECRET must be configured");
  }
  return secret;
};

const signaturesMatch = (provided: string, expected: string) => {
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < provided.length; i += 1) {
    difference |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return difference === 0;
};

export const createGoogleOAuthNonce = () => randomBytesHex(32);

export const signGoogleOAuthState = (
  session: UserSession,
  nonce: string,
): string => {
  const payload: GoogleOAuthStatePayload = {
    session,
    nonce,
    expiresAt: Date.now() + STATE_LIFETIME_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = hmacSha256Hex(getSigningSecret(), encodedPayload);
  return `${encodedPayload}.${signature}`;
};

export const verifyGoogleOAuthState = (
  value: string | null | undefined,
  expectedNonce: string | null | undefined,
): UserSession | null => {
  if (!value || !expectedNonce) return null;

  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const encodedPayload = value.slice(0, separator);
  const providedSignature = value.slice(separator + 1);
  const expectedSignature = hmacSha256Hex(
    getSigningSecret(),
    encodedPayload,
  );
  if (!signaturesMatch(providedSignature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as GoogleOAuthStatePayload;
    if (
      !payload ||
      typeof payload.nonce !== "string" ||
      payload.nonce !== expectedNonce ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Date.now() ||
      !payload.session ||
      typeof payload.session.id !== "string" ||
      typeof payload.session.sessionId !== "string"
    ) {
      return null;
    }

    return payload.session;
  } catch {
    return null;
  }
};
