import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db/db";
import ApiKey from "@/models/apiKey/ApiKey";
import BulkMessageJob from "@/models/message/BulkMessageJob";

type BulkJobDetailsSnapshot = {
  _id: Types.ObjectId;
  apiKeyId: string;
  templateName?: string;
  status: string;
  recipients: Array<{
    recipient: string;
    status: string;
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
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    const { jobId } = await params;
    if (!Types.ObjectId.isValid(jobId)) {
      return NextResponse.json({ error: "Invalid bulk job ID." }, { status: 400 });
    }

    await connectDB();
    const job = await BulkMessageJob.findById(jobId)
      .select("apiKeyId templateName status recipients createdAt completedAt")
      .lean<BulkJobDetailsSnapshot>();
    if (!job) {
      return NextResponse.json({ error: "Bulk message job not found." }, { status: 404 });
    }

    const apiKey = await ApiKey.findById(job.apiKeyId).select("adminId").lean();
    if (
      !apiKey ||
      (!adminResult.admin.isSuperAdmin &&
        apiKey.adminId !== String(adminResult.admin._id))
    ) {
      return NextResponse.json({ error: "Bulk message job not found." }, { status: 404 });
    }

    return NextResponse.json({
      jobId: String(job._id),
      status: job.status,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      recipients: job.recipients.map((recipient) => ({
        recipient: recipient.recipient,
        status: recipient.status,
        ...(recipient.error ? { error: recipient.error } : {}),
        ...(recipient.messageId ? { messageId: recipient.messageId } : {}),
      })),
    });
  } catch (error: unknown) {
    console.error("[api/admin/message-history] Failed to fetch bulk job:", error);
    return NextResponse.json(
      { error: "Failed to fetch bulk message job." },
      { status: 500 },
    );
  }
}
