import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import AdminTemplate from "@/models/admin/AdminTemplate";
import User from "@/models/user/User";

export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req, "sendMessage");
  if ("error" in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  const templateId = req.nextUrl.searchParams.get("templateId")?.trim() || "";
  const adminId = req.nextUrl.searchParams.get("adminId")?.trim() || "";
  if (
    !Types.ObjectId.isValid(templateId) ||
    !Types.ObjectId.isValid(adminId)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide a valid adminId and templateId",
      },
      { status: 400 },
    );
  }

  const senderId = String(authResult.apiKey.senderUserId || "");
  if (!Types.ObjectId.isValid(senderId)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "No valid sender account is bound to this API key. Bind an existing chat account ID in Admin > API Keys.",
      },
      { status: 400 },
    );
  }

  await connectDB();
  const sender = await User.exists({ _id: senderId });
  if (!sender) {
    return NextResponse.json(
      {
        success: false,
        error:
          "The sender account bound to this API key no longer exists. Update the sender in Admin > API Keys.",
      },
      { status: 404 },
    );
  }

  const keyOwner = await Admin.findById(String(authResult.apiKey.adminId))
    .select("isSuperAdmin")
    .lean();
  if (
    !keyOwner?.isSuperAdmin &&
    adminId !== String(authResult.apiKey.adminId)
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "This API key cannot access that admin workspace",
      },
      { status: 403 },
    );
  }
  if (
    keyOwner?.isSuperAdmin &&
    !(await Admin.exists({ _id: adminId }))
  ) {
    return NextResponse.json(
      { success: false, error: "Admin workspace not found" },
      { status: 404 },
    );
  }
  const template = await AdminTemplate.findOne({
    _id: templateId,
    adminId,
  })
    .select("_id")
    .lean();
  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Template not found for this API key. Use a template from the key owner’s workspace.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Connection successful. The API key, admin workspace, sender, and template are ready.",
    checks: {
      apiKey: "ok",
      adminWorkspace: "ok",
      sender: "ok",
      template: "ok",
    },
  });
}
