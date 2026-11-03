import { connectDB } from "@/lib/db/db";
import { encryptAuthEmailJobPayload } from "@/lib/crypto";
import AuthEmailJob from "@/models/auth/AuthEmailJob";
import type { SendMailOptions } from "nodemailer";

type AuthEmailPayload = Pick<SendMailOptions, "to" | "subject" | "text" | "html">;

export async function enqueueAuthEmail(
  challengeId: string,
  target: string,
  expiresAt: Date,
  mail: AuthEmailPayload,
): Promise<void> {
  await connectDB();
  await AuthEmailJob.create({
    challengeId,
    target,
    payload: encryptAuthEmailJobPayload(JSON.stringify(mail)),
    availableAt: new Date(),
    expiresAt,
  });
}
