import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { validateApiKey } from "@/lib/apiKeyAuth";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import AdminTemplate from "@/models/admin/AdminTemplate";
import User from "@/models/user/User";

const normalizeIndianMobile = (value: string): string | null => {
  if (!/^\+?[\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "");
  const mobile =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  return /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
};

export async function GET(req: NextRequest) {
  const authResult = await validateApiKey(req, "sendMessage");
  if ("error" in authResult) {
    return NextResponse.json(
      { success: false, error: authResult.error },
      { status: authResult.status },
    );
  }

  const templateId = req.nextUrl.searchParams.get("templateId")?.trim() || "";
  const toUserId = req.nextUrl.searchParams.get("toUserId")?.trim() || "";
  if (!Types.ObjectId.isValid(templateId) || !toUserId) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide a valid templateId and registered recipient toUserId",
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
  const template = await AdminTemplate.findOne({
    _id: templateId,
    ...(keyOwner?.isSuperAdmin
      ? {}
      : { adminId: String(authResult.apiKey.adminId) }),
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

  const recipientPhone = normalizeIndianMobile(toUserId);
  if (!Types.ObjectId.isValid(toUserId) && !recipientPhone) {
    return NextResponse.json(
      {
        success: false,
        error:
          "toUserId must be a chat account ID or a valid registered Indian mobile number",
      },
      { status: 400 },
    );
  }
  const recipient = await User.findOne(
    Types.ObjectId.isValid(toUserId)
      ? { _id: toUserId }
      : { mobile: recipientPhone },
  )
    .select("_id")
    .lean();
  if (!recipient) {
    return NextResponse.json(
      {
        success: false,
        error: "Recipient account not found. Register the recipient first.",
      },
      { status: 404 },
    );
  }
  if (String(recipient._id) === senderId) {
    return NextResponse.json(
      {
        success: false,
        error: "Sender and recipient must be different chat accounts.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Connection successful. The API key, sender, template, and recipient are ready.",
    checks: {
      apiKey: "ok",
      sender: "ok",
      template: "ok",
      recipient: "ok",
    },
  });
}
