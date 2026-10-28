import { randomInt, timingSafeEqual } from "node:crypto";
import { hmacSha256Hex, randomBytesHex } from "@/lib/crypto";
import { connectDB } from "@/lib/db/db";
import OtpChallenge, {
  type OtpChallengePurpose,
} from "@/models/auth/OtpChallenge";

const OTP_LIFETIME_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function getOtpSecret(): string {
  const secret =
    process.env.OTP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      "OTP_SECRET, SESSION_SECRET, or NEXTAUTH_SECRET must be configured",
    );
  }
  return secret;
}

export async function createOtpChallenge(
  target: string,
  purpose: OtpChallengePurpose,
): Promise<{ challengeId: string; otp: string }> {
  await connectDB();
  const otp = randomInt(100_000, 1_000_000).toString();
  const salt = randomBytesHex(16);
  const challengeId = randomBytesHex(16);
  const hash = hmacSha256Hex(getOtpSecret(), `${challengeId}:${otp}:${salt}`);
  const now = new Date();

  await OtpChallenge.updateMany(
    {
      target,
      purpose,
      expiresAt: { $gt: now },
      consumedAt: { $exists: false },
    },
    { $set: { consumedAt: now } },
  );
  await OtpChallenge.create({
    challengeId,
    target,
    purpose,
    hash,
    salt,
    attempts: 0,
    expiresAt: new Date(now.getTime() + OTP_LIFETIME_MS),
  });

  return { challengeId, otp };
}

export async function consumeOtpChallenge(
  challengeId: string,
  target: string,
  purposes: OtpChallengePurpose[],
  otp: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{32}$/i.test(challengeId)) return false;

  await connectDB();
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      challengeId,
      target,
      purpose: { $in: purposes },
      expiresAt: { $gt: new Date() },
      consumedAt: { $exists: false },
      attempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();

  if (!challenge) return false;

  const actualHash = Buffer.from(
    hmacSha256Hex(
      getOtpSecret(),
      `${challengeId}:${otp}:${challenge.salt}`,
    ),
    "hex",
  );
  const expectedHash = Buffer.from(challenge.hash, "hex");
  const isValid =
    actualHash.length === expectedHash.length &&
    timingSafeEqual(actualHash, expectedHash);

  if (!isValid) return false;

  const consumed = await OtpChallenge.updateOne(
    {
      challengeId,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumedAt: new Date() } },
  );

  return consumed.modifiedCount === 1;
}
