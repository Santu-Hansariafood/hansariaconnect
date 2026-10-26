import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db/db";
import ApiKey from "@/models/apiKey/ApiKey";
import Message from "@/models/message/Message";
import BulkMessageJob from "@/models/message/BulkMessageJob";

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  apiKeyId: z.string().optional(),
  templateName: z.string().optional(),
});

type BulkMessageHistoryJob = {
  _id: Types.ObjectId;
  apiKeyId: string;
  templateName?: string;
  status: "queued" | "processing" | "completed" | "partial" | "failed";
  recipients: Array<{
    status: "pending" | "processing" | "sent" | "failed";
  }>;
  createdAt: Date;
};

const parseIndiaDate = (value: string) => {
  const calendarDate = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return new Date(`${value}T00:00:00.000+05:30`);
};

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    const parsed = querySchema.safeParse(
      Object.fromEntries(new URL(req.url).searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Provide valid from and to dates in YYYY-MM-DD format." },
        { status: 400 },
      );
    }

    const fromDate = parseIndiaDate(parsed.data.from);
    const toDate = parseIndiaDate(parsed.data.to);
    if (!fromDate || !toDate || fromDate > toDate) {
      return NextResponse.json(
        { error: "The date range is invalid." },
        { status: 400 },
      );
    }

    const exclusiveToDate = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    if (
      exclusiveToDate.getTime() - fromDate.getTime() >
      366 * 24 * 60 * 60 * 1000
    ) {
      return NextResponse.json(
        { error: "Choose a date range of 366 days or less." },
        { status: 400 },
      );
    }

    if (
      parsed.data.apiKeyId &&
      !Types.ObjectId.isValid(parsed.data.apiKeyId)
    ) {
      return NextResponse.json({ error: "Invalid API key filter." }, { status: 400 });
    }
    if (parsed.data.templateName && parsed.data.templateName.length > 100) {
      return NextResponse.json(
        { error: "Template filter is too long." },
        { status: 400 },
      );
    }

    await connectDB();
    const apiKeys = await ApiKey.find(
      adminResult.admin.isSuperAdmin
        ? {}
        : { adminId: String(adminResult.admin._id) },
    )
      .select("_id name adminId")
      .lean();
    const visibleKeyIds = apiKeys.map((apiKey) => String(apiKey._id));

    if (
      parsed.data.apiKeyId &&
      !visibleKeyIds.includes(parsed.data.apiKeyId)
    ) {
      return NextResponse.json({ error: "API key not found." }, { status: 404 });
    }

    const match: Record<string, unknown> = {
      apiKeyId: parsed.data.apiKeyId
        ? parsed.data.apiKeyId
        : { $in: visibleKeyIds },
      createdAt: { $gte: fromDate, $lt: exclusiveToDate },
    };
    if (parsed.data.templateName) {
      if (parsed.data.templateName === "(No template recorded)") {
        match.apiTemplateName = { $exists: false };
      } else {
        match.apiTemplateName = parsed.data.templateName;
      }
    }

    const rows = visibleKeyIds.length
      ? await Message.aggregate<{
          _id: { date: string; apiKeyId: string; templateName: string };
          count: number;
        }>([
          { $match: match },
          {
            $group: {
              _id: {
                date: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$createdAt",
                    timezone: "Asia/Kolkata",
                  },
                },
                apiKeyId: "$apiKeyId",
                templateName: {
                  $ifNull: ["$apiTemplateName", "(No template recorded)"],
                },
              },
              count: { $sum: 1 },
            },
          },
          { $sort: { "_id.date": -1, "_id.apiKeyId": 1, "_id.templateName": 1 } },
          { $limit: 10000 },
        ])
      : [];
    const apiKeyMap = new Map(
      apiKeys.map((apiKey) => [String(apiKey._id), apiKey]),
    );
    const jobs = visibleKeyIds.length
      ? await BulkMessageJob.find({
          apiKeyId: parsed.data.apiKeyId
            ? parsed.data.apiKeyId
            : { $in: visibleKeyIds },
          createdAt: { $gte: fromDate, $lt: exclusiveToDate },
          ...(parsed.data.templateName
            ? parsed.data.templateName === "(No template recorded)"
              ? { templateName: { $exists: false } }
              : { templateName: parsed.data.templateName }
            : {}),
        })
          .select("apiKeyId templateName status recipients.status createdAt completedAt")
          .sort({ createdAt: -1 })
          .limit(100)
          .lean<BulkMessageHistoryJob[]>()
      : [];

    return NextResponse.json({
      rows: rows.map((row) => ({
        date: row._id.date,
        apiKeyId: row._id.apiKeyId,
        apiKeyName: apiKeyMap.get(row._id.apiKeyId)?.name || "Deleted API key",
        templateName: row._id.templateName,
        count: row.count,
      })),
      truncated: rows.length === 10000,
      jobs: jobs.map((job) => ({
        jobId: String(job._id),
        date: job.createdAt.toISOString(),
        apiKeyId: job.apiKeyId,
        apiKeyName: apiKeyMap.get(job.apiKeyId)?.name || "Deleted API key",
        templateName: job.templateName || "(No template recorded)",
        status: job.status,
        total: job.recipients.length,
        sent: job.recipients.filter((recipient) => recipient.status === "sent")
          .length,
        failed: job.recipients.filter(
          (recipient) => recipient.status === "failed",
        ).length,
        pending: job.recipients.filter(
          (recipient) =>
            recipient.status === "pending" ||
            recipient.status === "processing",
        ).length,
      })),
      jobsTruncated: jobs.length === 100,
    });
  } catch (error: unknown) {
    console.error("[api/admin/message-history] Failed to fetch message history:", error);
    return NextResponse.json(
      { error: "Failed to fetch API message history." },
      { status: 500 },
    );
  }
}
