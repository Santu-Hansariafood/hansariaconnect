import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { API_CORS_ORIGIN } from "@/lib/apiCors";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import AdminTemplate from "@/models/admin/AdminTemplate";
import User from "@/models/user/User";

const CHECK_ORDER = [
  "apiKey",
  "request",
  "sender",
  "adminWorkspace",
  "template",
] as const;

type CheckName = (typeof CHECK_ORDER)[number];
type CheckState = "ok" | "failed" | "skipped";

type CheckReport = Record<CheckName, CheckState>;

const createCheckReport = (): CheckReport =>
  CHECK_ORDER.reduce((report, name) => {
    report[name] = "skipped";
    return report;
  }, {} as CheckReport);

export async function GET(req: NextRequest) {
  const checks = createCheckReport();
  const diagnostics = {
    requestOrigin: req.headers.get("origin"),
    allowedOrigin: API_CORS_ORIGIN,
    checkedAt: new Date().toISOString(),
  };
  const failure = (
    failedAt: CheckName,
    status: number,
    error: string,
  ): NextResponse => {
    checks[failedAt] = "failed";
    return NextResponse.json(
      { success: false, error, failedAt, checks, diagnostics },
      { status },
    );
  };

  const authResult = await validateApiKey(req, "sendMessage");
  if ("error" in authResult) {
    return failure("apiKey", authResult.status ?? 401, authResult.error);
  }
  checks.apiKey = "ok";

  const templateId = req.nextUrl.searchParams.get("templateId")?.trim() || "";
  const adminId = req.nextUrl.searchParams.get("adminId")?.trim() || "";
  const requestedSenderUserId =
    req.nextUrl.searchParams.get("senderUserId")?.trim() || "";
  if (
    !Types.ObjectId.isValid(templateId) ||
    !Types.ObjectId.isValid(adminId)
  ) {
    return failure(
      "request",
      400,
      "Provide a valid adminId and templateId",
    );
  }
  checks.request = "ok";

  const senderId = String(
    authResult.apiKey.senderUserId || requestedSenderUserId,
  );
  if (!Types.ObjectId.isValid(senderId)) {
    return failure(
      "sender",
      400,
      "Provide a valid sender chat-account ID or bind one to this API key in Admin > API Keys.",
    );
  }
  if (
    authResult.apiKey.senderUserId &&
    requestedSenderUserId &&
    String(authResult.apiKey.senderUserId) !== requestedSenderUserId
  ) {
    return failure(
      "sender",
      403,
      "senderUserId must match the sender bound to this API key",
    );
  }

  await connectDB();
  const sender = await User.exists({ _id: senderId });
  if (!sender) {
    return failure(
      "sender",
      404,
      "The sender account bound to this API key no longer exists. Update the sender in Admin > API Keys.",
    );
  }
  checks.sender = "ok";

  const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
    .select("isSuperAdmin")
    .lean();
  if (
    !keyOwner?.isSuperAdmin &&
    adminId !== String(authResult.apiKey.adminId)
  ) {
    return failure(
      "adminWorkspace",
      403,
      "This API key cannot access that admin workspace",
    );
  }
  if (
    keyOwner?.isSuperAdmin &&
    !(await Admin.exists({ _id: adminId }))
  ) {
    return failure("adminWorkspace", 404, "Admin workspace not found");
  }
  checks.adminWorkspace = "ok";

  const template = await AdminTemplate.findOne({
    _id: templateId,
    adminId,
  })
    .select("_id")
    .lean();
  if (!template) {
    return failure(
      "template",
      404,
      "Template not found for this API key. Use a template from the key owner’s workspace.",
    );
  }
  checks.template = "ok";

  return NextResponse.json({
    success: true,
    message:
      "Connection successful. The API key, admin workspace, sender, and template are ready.",
    checks,
    diagnostics,
  });
}
