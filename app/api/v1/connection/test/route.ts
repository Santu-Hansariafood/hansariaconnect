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

  /*
   * Everything past the API key is optional, so the simplest possible
   * connection check is a single request that carries only the key:
   *
   *   curl -H "Authorization: Bearer $HANSARIA_API_KEY" <test url>
   *
   * Add `templateId` (and `adminId` for a super admin) or `senderUserId` to
   * validate those as well; anything not supplied is reported as `skipped`
   * instead of failing, so a valid key alone returns `success: true`.
   */
  const templateId = req.nextUrl.searchParams.get("templateId")?.trim() || "";
  const adminId = req.nextUrl.searchParams.get("adminId")?.trim() || "";
  const requestedSenderUserId =
    req.nextUrl.searchParams.get("senderUserId")?.trim() || "";
  if (
    (templateId && !Types.ObjectId.isValid(templateId)) ||
    (adminId && !Types.ObjectId.isValid(adminId))
  ) {
    return failure(
      "request",
      400,
      "adminId and templateId must be valid IDs when provided",
    );
  }
  checks.request = "ok";

  await connectDB();

  const senderId = String(
    authResult.apiKey.senderUserId || requestedSenderUserId,
  );
  if (senderId) {
    if (!Types.ObjectId.isValid(senderId)) {
      return failure(
        "sender",
        400,
        "senderUserId must be a chat-account ID, or bind a sender to this API key in Admin > API Keys.",
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

    const sender = await User.exists({ _id: senderId });
    if (!sender) {
      return failure(
        "sender",
        404,
        "The sender account bound to this API key no longer exists. Update the sender in Admin > API Keys.",
      );
    }
    checks.sender = "ok";
  }

  if (adminId || templateId) {
    const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
      .select("isSuperAdmin")
      .lean();

    if (adminId) {
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
      if (keyOwner?.isSuperAdmin && !(await Admin.exists({ _id: adminId }))) {
        return failure("adminWorkspace", 404, "Admin workspace not found");
      }
      checks.adminWorkspace = "ok";
    }

    if (templateId) {
      // Without an explicit adminId the key's own workspace is the scope, which
      // is what every non-super-admin key already uses.
      const template = await AdminTemplate.findOne({
        _id: templateId,
        adminId: adminId || String(authResult.apiKey.adminId),
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
    }
  }

  const verified = Object.entries(checks)
    .filter(([, state]) => state === "ok")
    .map(([name]) => name);
  const skipped = Object.entries(checks)
    .filter(([, state]) => state === "skipped")
    .map(([name]) => name);

  return NextResponse.json({
    success: true,
    message:
      skipped.length === 0
        ? "Connection successful. The API key, admin workspace, sender, and template are ready."
        : `Connection successful. Verified: ${verified.join(", ")}. Skipped (not supplied): ${skipped.join(", ")}.`,
    checks,
    diagnostics,
  });
}
