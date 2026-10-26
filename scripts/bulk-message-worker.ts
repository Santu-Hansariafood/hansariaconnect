import { connectDB } from "@/lib/db/db";
import { processNextBulkMessageRecipient } from "@/lib/api/bulkMessageWorker";
import Message from "@/models/message/Message";
import mongoose from "mongoose";

const POLL_INTERVAL_MS = 1_000;
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function runWorker() {
  if (!process.env.BULK_MESSAGE_WORKER_SECRET) {
    throw new Error("BULK_MESSAGE_WORKER_SECRET is not configured");
  }
  await connectDB();
  await Message.collection.createIndex(
    { bulkJobId: 1, bulkRecipientIndex: 1 },
    {
      unique: true,
      partialFilterExpression: {
        bulkJobId: { $type: "objectId" },
        bulkRecipientIndex: { $type: "number" },
      },
    },
  );
  console.log("[bulk-message-worker] Started");

  while (!stopping) {
    try {
      const processed = await processNextBulkMessageRecipient();
      if (!processed) await delay(POLL_INTERVAL_MS);
    } catch (error: unknown) {
      console.error("[bulk-message-worker] Poll failed:", error);
      await delay(5_000);
    }
  }

  console.log("[bulk-message-worker] Stopping");
  await mongoose.disconnect();
}

runWorker().catch((error: unknown) => {
  console.error("[bulk-message-worker] Fatal startup error:", error);
  process.exitCode = 1;
});
