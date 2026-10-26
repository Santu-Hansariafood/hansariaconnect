import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import BulkMessageJob from "@/models/message/BulkMessageJob";
import {
  applyApiRateLimitHeaders,
  consumeApiRateLimit,
  RateLimitStoreUnavailableError,
} from "@/lib/apiRateLimit";

type BulkJobStatusSnapshot = {
  _id: Types.ObjectId;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  recipients: Array<{
    recipient: string;
    status: "pending" | "processing" | "sent" | "failed";
    error?: string;
    messageId?: string;
  }>;
  createdAt: Date;
  completedAt?: Date;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const authResult = await validateApiKey(req, "sendMessage");
  if ("error" in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status },
    );
  }
  let rateLimit;
  try {
    rateLimit = await consumeApiRateLimit(String(authResult.apiKey._id), 0);
  } catch (error: unknown) {
    if (error instanceof RateLimitStoreUnavailableError) {
      return NextResponse.json(
        { success: false, error: "API rate limiting is temporarily unavailable" },
        { status: 503 },
      );
    }
    throw error;
  }
  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { success: false, error: "API rate limit exceeded" },
      { status: 429 },
    );
    applyApiRateLimitHeaders(response.headers, rateLimit);
    return response;
  }

  const { jobId } = await params;
  if (!Types.ObjectId.isValid(jobId)) {
    return NextResponse.json(
      { success: false, error: "jobId must be a valid job ID" },
      { status: 400 },
    );
  }

  await connectDB();
  const job = await BulkMessageJob.findOne({
    _id: jobId,
    apiKeyId: String(authResult.apiKey._id),
  })
    .select("status recipients createdAt completedAt")
    .lean<BulkJobStatusSnapshot>();
  if (!job) {
    return NextResponse.json(
      { success: false, error: "Bulk message job not found" },
      { status: 404 },
    );
  }

  const sent = job.recipients.filter(
    (recipient) => recipient.status === "sent",
  ).length;
  const failed = job.recipients.filter(
    (recipient) => recipient.status === "failed",
  ).length;

  const response = NextResponse.json({
    success: true,
    jobId: String(job._id),
    status: job.status,
    total: job.recipients.length,
    sent,
    failed,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    recipients: job.recipients.map((recipient) => ({
      recipient: recipient.recipient,
      status: recipient.status,
      ...(recipient.error ? { error: recipient.error } : {}),
      ...(recipient.messageId ? { messageId: recipient.messageId } : {}),
    })),
  });
  applyApiRateLimitHeaders(response.headers, rateLimit);
  return response;
}
