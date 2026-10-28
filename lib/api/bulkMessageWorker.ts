import { Types } from "mongoose";
import { z } from "zod";
import BulkMessageJob, {
  type IBulkMessageJob,
} from "@/models/message/BulkMessageJob";
import Conversation from "@/models/conversation/Conversation";
import Message from "@/models/message/Message";
import {
  decryptBulkMessageJobPayload,
  decryptDirectMessageContent,
  encryptDirectMessageContent,
} from "@/lib/crypto";
import { templateActionButtonsSchema } from "@/lib/templateActionButtons";

const MAX_ATTEMPTS = 5;
const JOB_LEASE_MS = 5 * 60_000;
const RECIPIENTS_PER_BATCH = 10;
const bulkPayloadSchema = z.array(
  z.object({
    toUserId: z.string(),
    text: z.string(),
    mediaUrl: z.string(),
    fileName: z.string(),
    fileSize: z.string(),
    type: z.enum(["text", "image", "video", "voice", "pdf", "excel", "file"]),
    buttons: templateActionButtonsSchema,
  }),
);
const errMsg = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

async function emitMessageFromWorker(
  fromUserId: string,
  toUserId: string,
  message: {
    id: string;
    from: string;
    to: string;
    type: string;
    text: string;
    mediaUrl: string;
    fileName: string;
    fileSize: string;
    buttons: Array<{
      type: "call" | "reply" | "confirm";
      label: string;
      phoneNumber?: string;
      replyText?: string;
    }>;
    timestamp: Date;
    status: "sent";
  },
) {
  const secret = process.env.BULK_MESSAGE_WORKER_SECRET;
  if (!secret) throw new Error("BULK_MESSAGE_WORKER_SECRET is not configured");
  let appUrl: URL;
  try {
    appUrl = new URL(
      process.env.BULK_MESSAGE_APP_URL || "http://127.0.0.1:4000",
    );
  } catch {
    throw new Error("BULK_MESSAGE_APP_URL must be a valid local URL");
  }
  if (
    appUrl.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(appUrl.hostname) ||
    appUrl.pathname !== "/" ||
    appUrl.search ||
    appUrl.hash ||
    appUrl.username ||
    appUrl.password
  ) {
    throw new Error("BULK_MESSAGE_APP_URL must use a loopback HTTP address");
  }
  const response = await fetch(
    new URL("/api/internal/bulk-message-worker/events", appUrl),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fromUserId, toUserId, message }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!response.ok) {
    throw new Error(`Worker event delivery failed with HTTP ${response.status}`);
  }
}

export async function processNextBulkMessageRecipient(): Promise<boolean> {
  const now = new Date();
  const job: IBulkMessageJob | null = await BulkMessageJob.findOneAndUpdate(
    {
      $or: [
        { status: "queued" },
        {
          status: "processing",
          $or: [
            { leaseUntil: { $lte: now } },
            { leaseUntil: { $exists: false } },
          ],
        },
      ],
    },
    {
      $set: {
        status: "processing",
        leaseUntil: new Date(now.getTime() + JOB_LEASE_MS),
      },
    },
    { sort: { createdAt: 1 }, new: true },
  );
  if (!job) return false;

  let payload: z.infer<typeof bulkPayloadSchema>;
  try {
    payload = bulkPayloadSchema.parse(
      JSON.parse(
        decryptBulkMessageJobPayload(String(job._id), job.payload || ""),
      ),
    );
    if (payload.length !== job.recipients.length) {
      throw new Error("Bulk message job recipient count does not match payload");
    }
  } catch (error: unknown) {
    const alreadySent = job.recipients.some(
      (recipient) => recipient.status === "sent",
    );
    console.error(
      `[bulk-message-worker] Invalid payload for job ${String(job._id)}:`,
      errMsg(error),
    );
    await BulkMessageJob.updateOne(
      { _id: job._id },
      {
        $set: {
          status: alreadySent ? "partial" : "failed",
          completedAt: now,
          "recipients.$[recipient].status": "failed",
          "recipients.$[recipient].error":
            "Queued message data could not be read.",
        },
        $unset: { leaseUntil: 1, payload: 1 },
      },
      { arrayFilters: [{ "recipient.status": { $in: ["pending", "processing"] } }] },
    );
    return true;
  }

  await BulkMessageJob.updateOne(
    { _id: job._id, status: "processing" },
    {
      $set: {
        "recipients.$[recipient].status": "pending",
        "recipients.$[recipient].nextAttemptAt": now,
      },
    },
    { arrayFilters: [{ "recipient.status": "processing" }] },
  );
  for (const recipient of job.recipients) {
    if (recipient.status === "processing") {
      recipient.status = "pending";
      recipient.nextAttemptAt = now;
    }
  }
  const recipientIndices = job.recipients
    .flatMap((recipient, index) =>
      recipient.status === "pending" &&
      (!recipient.nextAttemptAt || recipient.nextAttemptAt <= now)
        ? [index]
        : [],
    )
    .slice(0, RECIPIENTS_PER_BATCH);

  if (!recipientIndices.length) {
    const pending = job.recipients.filter(
      (recipient) => recipient.status === "pending",
    );
    if (!pending.length) {
      const sent = job.recipients.filter(
        (recipient) => recipient.status === "sent",
      ).length;
      const failed = job.recipients.length - sent;
      await BulkMessageJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status:
              failed === 0 ? "completed" : sent === 0 ? "failed" : "partial",
            completedAt: now,
          },
          $unset: { leaseUntil: 1, payload: 1 },
        },
      );
    } else {
      const nextAttemptAt = pending.reduce(
        (earliest, recipient) =>
          recipient.nextAttemptAt && recipient.nextAttemptAt < earliest
            ? recipient.nextAttemptAt
            : earliest,
        pending[0].nextAttemptAt || now,
      );
      await BulkMessageJob.updateOne(
        { _id: job._id },
        { $set: { leaseUntil: nextAttemptAt } },
      );
    }
    return true;
  }

  const senderId = job.senderId;
  const claimUpdate: {
    $set: Record<string, unknown>;
    $inc: Record<string, number>;
  } = {
    $set: { leaseUntil: new Date(Date.now() + JOB_LEASE_MS) },
    $inc: {},
  };
  for (const recipientIndex of recipientIndices) {
    const recipientPath = `recipients.${recipientIndex}`;
    claimUpdate.$set[`${recipientPath}.status`] = "processing";
    claimUpdate.$set[`${recipientPath}.nextAttemptAt`] = null;
    claimUpdate.$inc[`${recipientPath}.attempts`] = 1;
    job.recipients[recipientIndex].status = "processing";
    job.recipients[recipientIndex].attempts += 1;
  }
  await BulkMessageJob.updateOne({ _id: job._id }, claimUpdate);

  const processRecipient = async (recipientIndex: number) => {
    const recipient = job.recipients[recipientIndex];
    const messageData = payload[recipientIndex];
    const toUserId = recipient.toUserId;
    const recipientPath = `recipients.${recipientIndex}`;

    try {
      const encrypted = {
        text: encryptDirectMessageContent(senderId, toUserId, messageData.text),
        mediaUrl: encryptDirectMessageContent(
          senderId,
          toUserId,
          messageData.mediaUrl,
        ),
        fileName: encryptDirectMessageContent(
          senderId,
          toUserId,
          messageData.fileName,
        ),
        fileSize: encryptDirectMessageContent(
          senderId,
          toUserId,
          messageData.fileSize,
        ),
      };
      const message = await Message.findOneAndUpdate(
        {
          bulkJobId: job._id,
          bulkRecipientIndex: recipientIndex,
        },
        {
          $setOnInsert: {
            from: new Types.ObjectId(senderId),
            to: new Types.ObjectId(toUserId),
            apiKeyId: job.apiKeyId,
            apiTemplateName: job.templateName,
            bulkJobId: job._id,
            bulkRecipientIndex: recipientIndex,
            type: messageData.type,
            ...encrypted,
            buttons: messageData.buttons,
            status: "sent",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if (!message) throw new Error("Could not persist the queued message");

      const senderObjectId = new Types.ObjectId(senderId);
      const recipientObjectId = new Types.ObjectId(toUserId);
      const userA =
        senderId < toUserId ? senderObjectId : recipientObjectId;
      const userB =
        senderId < toUserId ? recipientObjectId : senderObjectId;
      try {
        await Conversation.findOneAndUpdate(
          { userA, userB },
          {
            $setOnInsert: { userA, userB },
            $max: { lastMessageAt: message.createdAt },
          },
          { upsert: true },
        );
      } catch (error) {
        if (
          typeof error !== "object" ||
          error === null ||
          !("code" in error) ||
          error.code !== 11000
        ) {
          throw error;
        }
        await Conversation.findOneAndUpdate(
          { userA, userB },
          { $max: { lastMessageAt: message.createdAt } },
        );
      }

      try {
        await emitMessageFromWorker(senderId, toUserId, {
          id: String(message._id),
          from: senderId,
          to: toUserId,
          type: messageData.type,
          text: decryptDirectMessageContent(senderId, toUserId, encrypted.text),
          mediaUrl: decryptDirectMessageContent(
            senderId,
            toUserId,
            encrypted.mediaUrl,
          ),
          fileName: decryptDirectMessageContent(
            senderId,
            toUserId,
            encrypted.fileName,
          ),
          fileSize: decryptDirectMessageContent(
            senderId,
            toUserId,
            encrypted.fileSize,
          ),
          buttons: messageData.buttons,
          timestamp: message.createdAt,
          status: "sent",
        });
      } catch (error: unknown) {
        console.error(
          `[bulk-message-worker] Realtime notification failed for message ${String(message._id)}:`,
          errMsg(error),
        );
      }

      await BulkMessageJob.updateOne(
        { _id: job._id },
        {
          $set: {
            [`${recipientPath}.status`]: "sent",
            [`${recipientPath}.messageId`]: String(message._id),
            [`${recipientPath}.error`]: "",
            [`${recipientPath}.nextAttemptAt`]: null,
          },
        },
      );
    } catch (error: unknown) {
      const attempts = recipient.attempts;
      console.error(
        `[bulk-message-worker] Failed job ${String(job._id)} recipient ${recipientIndex}:`,
        errMsg(error),
      );
      const exhausted = attempts >= MAX_ATTEMPTS;
      const retryAt = new Date(
        Date.now() + Math.min(60_000, 1_000 * 2 ** (attempts - 1)),
      );
      await BulkMessageJob.updateOne(
        { _id: job._id },
        {
          $set: {
            [`${recipientPath}.status`]: exhausted ? "failed" : "pending",
            [`${recipientPath}.error`]: exhausted
              ? "Message could not be sent after several attempts."
              : "Temporary processing error; retry scheduled.",
            [`${recipientPath}.nextAttemptAt`]: exhausted ? null : retryAt,
            leaseUntil: exhausted ? new Date() : retryAt,
          },
        },
      );
    }
  };

  await Promise.all(recipientIndices.map(processRecipient));

  const updatedJob: IBulkMessageJob | null = await BulkMessageJob.findById(job._id).select(
    "recipients",
  );
  if (updatedJob) {
    const sent = updatedJob.recipients.filter(
      (item) => item.status === "sent",
    ).length;
    const pending = updatedJob.recipients.filter(
      (item) => item.status === "pending" || item.status === "processing",
    );
    if (!pending.length) {
      const failed = updatedJob.recipients.length - sent;
      await BulkMessageJob.updateOne(
        { _id: job._id },
        {
          $set: {
            status:
              failed === 0 ? "completed" : sent === 0 ? "failed" : "partial",
            completedAt: new Date(),
          },
          $unset: { leaseUntil: 1, payload: 1 },
        },
      );
    } else {
      const currentTime = new Date();
      const nextEligibleAt = pending.reduce(
        (earliest, item) => {
          const eligibleAt = item.nextAttemptAt || currentTime;
          return eligibleAt < earliest ? eligibleAt : earliest;
        },
        pending[0].nextAttemptAt || currentTime,
      );
      await BulkMessageJob.updateOne(
        { _id: job._id },
        { $set: { leaseUntil: nextEligibleAt } },
      );
    }
  }
  return true;
}
