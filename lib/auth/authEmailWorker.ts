import { connectDB } from "@/lib/db/db";
import { decryptAuthEmailJobPayload } from "@/lib/crypto";
import AuthEmailJob from "@/models/auth/AuthEmailJob";
import OtpChallenge from "@/models/auth/OtpChallenge";
import { mailFrom, sendMail } from "@/lib/mailer";
import type { SendMailOptions } from "nodemailer";

const MAX_ATTEMPTS = 8;
const JOB_LEASE_MS = 60_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

function parseMailPayload(payload: string): SendMailOptions {
  const value: unknown = JSON.parse(decryptAuthEmailJobPayload(payload));
  if (
    typeof value !== "object" ||
    value === null ||
    !("to" in value) ||
    !("subject" in value) ||
    !("text" in value) ||
    !("html" in value) ||
    typeof value.to !== "string" ||
    typeof value.subject !== "string" ||
    typeof value.text !== "string" ||
    typeof value.html !== "string"
  ) {
    throw new Error("Invalid auth email job payload");
  }
  return {
    to: value.to,
    subject: value.subject,
    text: value.text,
    html: value.html,
  };
}

export async function processNextAuthEmailJob(): Promise<boolean> {
  const now = new Date();
  const job = await AuthEmailJob.findOneAndUpdate(
    {
      availableAt: { $lte: now },
      expiresAt: { $gt: now },
      $or: [
        { status: "queued", attempts: { $lt: MAX_ATTEMPTS } },
        { status: "processing", leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        status: "processing",
        leaseUntil: new Date(now.getTime() + JOB_LEASE_MS),
      },
      $inc: { attempts: 1 },
    },
    { sort: { createdAt: 1 }, new: true },
  );

  if (!job) return false;

  if (job.attempts > MAX_ATTEMPTS) {
    await AuthEmailJob.updateOne(
      { _id: job._id, status: "processing" },
      {
        $set: { status: "failed" },
        $unset: { payload: 1, leaseUntil: 1 },
      },
    );
    console.error(`[auth-email-worker] Job ${String(job._id)} exhausted retries`);
    return true;
  }

  try {
    const challenge = await OtpChallenge.exists({
      challengeId: job.challengeId,
      target: job.target,
      purpose: "login",
      expiresAt: { $gt: now },
      consumedAt: { $exists: false },
    });
    if (!challenge) {
      const result = await AuthEmailJob.updateOne(
        { _id: job._id, status: "processing", leaseUntil: job.leaseUntil },
        {
          $set: { status: "failed" },
          $unset: { payload: 1, leaseUntil: 1 },
        },
      );
      if (result.modifiedCount !== 1) {
        throw new Error(
          `Could not discard expired OTP email job ${String(job._id)}`,
        );
      }
      return true;
    }

    await sendMail({
      ...parseMailPayload(job.payload || ""),
      from: mailFrom(),
    });
    const result = await AuthEmailJob.updateOne(
      { _id: job._id, status: "processing", leaseUntil: job.leaseUntil },
      {
        $set: { status: "sent" },
        $unset: { payload: 1, leaseUntil: 1 },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error("Auth email job lease was lost before completion");
    }
  } catch (error: unknown) {
    const exhausted = job.attempts >= MAX_ATTEMPTS;
    const retryDelay = Math.min(
      1_000 * 2 ** (job.attempts - 1),
      MAX_RETRY_DELAY_MS,
    );
    const result = await AuthEmailJob.updateOne(
      { _id: job._id, status: "processing", leaseUntil: job.leaseUntil },
      {
        $set: {
          status: exhausted ? "failed" : "queued",
          availableAt: new Date(Date.now() + retryDelay),
        },
        $unset: { leaseUntil: 1, ...(exhausted ? { payload: 1 } : {}) },
      },
    );
    if (result.modifiedCount !== 1) {
      throw new Error(
        `Could not persist auth email retry state for job ${String(job._id)}`,
        { cause: error },
      );
    }
    console.error(
      `[auth-email-worker] Delivery attempt ${job.attempts} failed for job ${String(job._id)}:`,
      error instanceof Error ? error.message : String(error),
    );
  }

  return true;
}

export async function initializeAuthEmailWorker(): Promise<void> {
  await connectDB();
  await AuthEmailJob.collection.createIndex({
    status: 1,
    availableAt: 1,
    createdAt: 1,
  });
  await AuthEmailJob.collection.createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 },
  );
}
