import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import ApiKey from "@/models/apiKey/ApiKey";
import User from "@/models/user/User";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    await connectDB();
    const body = await req.json();
    const { isActive, isPrimary, senderUserId } = body;
    const resolved =
      context.params instanceof Promise ? await context.params : context.params;

    const apiKey = await ApiKey.findOne({
      _id: resolved.id,
      ...(adminResult.admin.isSuperAdmin
        ? {}
        : { adminId: String(adminResult.admin._id) }),
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (
      isPrimary === true &&
      (isActive === false || (!isActive && !apiKey.isActive))
    ) {
      return NextResponse.json(
        { error: "Only an active API key can be primary" },
        { status: 400 },
      );
    }

    if (typeof isActive === "boolean") {
      apiKey.isActive = isActive;
      if (!isActive) {
        apiKey.isPrimary = false;
      }
    }

    if (typeof isPrimary === "boolean") {
      if (isPrimary) {
        await ApiKey.updateMany(
          {
            adminId: apiKey.adminId,
            _id: { $ne: apiKey._id },
            isPrimary: true,
          },
          { $set: { isPrimary: false } },
        );
      }
      apiKey.isPrimary = isPrimary;
    }

    if (Object.prototype.hasOwnProperty.call(body, "senderUserId")) {
      if (typeof senderUserId !== "string") {
        return NextResponse.json(
          { error: "Sender chat account ID must be a string" },
          { status: 400 },
        );
      }

      const normalizedSenderUserId = senderUserId.trim();
      if (normalizedSenderUserId) {
        if (!Types.ObjectId.isValid(normalizedSenderUserId)) {
          return NextResponse.json(
            { error: "Enter a valid sender chat account ID" },
            { status: 400 },
          );
        }

        const senderQuery: Record<string, unknown> = {
          _id: new Types.ObjectId(normalizedSenderUserId),
        };
        if (!adminResult.admin.isSuperAdmin) {
          senderQuery.$or = [
            { createdByAdminId: apiKey.adminId },
            { createdByAdminId: null },
          ];
        }
        const sender = await User.exists(senderQuery);
        if (!sender) {
          return NextResponse.json(
            {
              error:
                "Sender account not found in this workspace. Use an existing chat account ID, not an admin ID or phone number.",
            },
            { status: 404 },
          );
        }

        apiKey.senderUserId = normalizedSenderUserId;
      } else {
        apiKey.senderUserId = undefined;
      }
    }

    await apiKey.save();

    return NextResponse.json({
      success: true,
      apiKey: {
        _id: apiKey._id,
        name: apiKey.name,
        senderUserId: apiKey.senderUserId,
        isPrimary: apiKey.isPrimary,
        permissions: apiKey.permissions,
        lastUsed: apiKey.lastUsed,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { error: "Another primary API key was selected at the same time. Please retry." },
        { status: 409 },
      );
    }
    console.error("[api/admin/api-keys] Failed to update API key:", error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    await connectDB();
    const resolved =
      context.params instanceof Promise ? await context.params : context.params;
    const deletedApiKey = await ApiKey.findOneAndDelete({
      _id: resolved.id,
      ...(adminResult.admin.isSuperAdmin
        ? {}
        : { adminId: String(adminResult.admin._id) }),
    });

    if (!deletedApiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error: unknown) {
    console.error("[api/admin/api-keys] Failed to delete API key:", error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 },
    );
  }
}
