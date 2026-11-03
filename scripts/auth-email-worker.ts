import mongoose from "mongoose";
import {
  initializeAuthEmailWorker,
  processNextAuthEmailJob,
} from "@/lib/auth/authEmailWorker";

const POLL_INTERVAL_MS = 250;
const ERROR_DELAY_MS = 1_000;
let stopping = false;

process.on("SIGINT", () => {
  stopping = true;
});
process.on("SIGTERM", () => {
  stopping = true;
});

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function workerLoop(workerIndex: number): Promise<void> {
  while (!stopping) {
    try {
      const processed = await processNextAuthEmailJob();
      if (!processed) await delay(POLL_INTERVAL_MS);
    } catch (error: unknown) {
      console.error(`[auth-email-worker:${workerIndex}] Poll failed:`, error);
      await delay(ERROR_DELAY_MS);
    }
  }
}

async function runWorker(): Promise<void> {
  const concurrency = Number(process.env.AUTH_EMAIL_WORKER_CONCURRENCY || 3);
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 100) {
    throw new Error("AUTH_EMAIL_WORKER_CONCURRENCY must be an integer from 1 to 100");
  }

  await initializeAuthEmailWorker();
  console.log(`[auth-email-worker] Started with concurrency ${concurrency}`);

  await Promise.all(
    Array.from({ length: concurrency }, (_, index) => workerLoop(index + 1)),
  );

  console.log("[auth-email-worker] Stopping");
  await mongoose.disconnect();
}

runWorker().catch((error: unknown) => {
  console.error("[auth-email-worker] Fatal startup error:", error);
  process.exitCode = 1;
});
