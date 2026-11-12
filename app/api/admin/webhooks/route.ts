import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db/db";
import { encryptWebhookSecret, randomBytesHex } from "@/lib/crypto";
import Admin from "@/models/admin/Admin";
import WebhookConfig, { WEBHOOK_EVENTS } from "@/models/admin/WebhookConfig";

const requestSchema = z.object({
  adminId: z.string().trim().optional(),
  url: z.string().trim().max(2048),
  enabled: z.boolean(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).max(WEBHOOK_EVENTS.length),
  rotateSecret: z.boolean().optional().default(false),
});

async function getWorkspaceId(
  admin: { _id: unknown; isSuperAdmin: boolean },
  requestedId?: string,
) {
  const adminId = admin.isSuperAdmin && requestedId
    ? requestedId
    : String(admin._id);
  if (!admin.isSuperAdmin && requestedId && requestedId !== adminId) {
    return { error: "You cannot manage another workspace's webhook", status: 403 } as const;
  }
  if (admin.isSuperAdmin && requestedId) {
    if (!/^[a-f\d]{24}$/i.test(adminId) || !(await Admin.exists({ _id: adminId }))) {
      return { error: "Admin workspace not found", status: 404 } as const;
    }
  }
  return { adminId } as const;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await connectDB();
  const workspace = await getWorkspaceId(
    auth.admin,
    req.nextUrl.searchParams.get("adminId") || undefined,
  );
  if ("error" in workspace) {
    return NextResponse.json({ error: workspace.error }, { status: workspace.status });
  }

  const config = await WebhookConfig.findOne({ adminId: workspace.adminId })
    .select("url events enabled secret")
    .lean();
  return NextResponse.json({
    webhook: config
      ? {
          url: config.url,
          events: config.events,
          enabled: config.enabled,
          hasSecret: Boolean(config.secret),
        }
      : {
          url: "",
          events: [...WEBHOOK_EVENTS],
          enabled: false,
          hasSecret: false,
        },
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  await connectDB();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid webhook settings" },
      { status: 400 },
    );
  }
  const { url, enabled, events, rotateSecret, adminId: requestedId } = parsed.data;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ error: "Enter a valid HTTPS webhook URL" }, { status: 400 });
  }
  if (
    parsedUrl.protocol !== "https:" ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.hash ||
    (parsedUrl.port && parsedUrl.port !== "443")
  ) {
    return NextResponse.json(
      { error: "Webhook URL must use HTTPS on port 443 and cannot include credentials or a fragment" },
      { status: 400 },
    );
  }
  if (enabled && !url) {
    return NextResponse.json({ error: "Enter a webhook URL before enabling delivery" }, { status: 400 });
  }

  const workspace = await getWorkspaceId(auth.admin, requestedId);
  if ("error" in workspace) {
    return NextResponse.json({ error: workspace.error }, { status: workspace.status });
  }

  const current = await WebhookConfig.findOne({ adminId: workspace.adminId });
  const secret = rotateSecret || !current
    ? randomBytesHex(32)
    : undefined;
  const update = {
    adminId: workspace.adminId,
    url,
    enabled,
    events: [...new Set(events)],
    ...(secret ? { secret: encryptWebhookSecret(secret) } : {}),
  };
  await WebhookConfig.findOneAndUpdate(
    { adminId: workspace.adminId },
    { $set: update },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  return NextResponse.json({
    success: true,
    webhook: { url, enabled, events: update.events, hasSecret: true },
    ...(secret ? { signingSecret: secret } : {}),
  });
}
