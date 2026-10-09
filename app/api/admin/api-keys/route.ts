import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import ApiKey from "@/models/apiKey/ApiKey";
import Message from "@/models/message/Message";
import User from "@/models/user/User";
import Admin from "@/models/admin/Admin";
import { Types } from "mongoose";
import { z } from "zod";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Key name is required").max(100),
  adminId: z.string().trim().optional(),
  senderUserId: z
    .string()
    .trim()
    .refine((value) => Types.ObjectId.isValid(value), {
      message: "Sender chat account ID must be a valid account ObjectId",
    })
    .optional(),
  expiresDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    await connectDB();
    const apiKeys = await ApiKey.find(
      adminResult.admin.isSuperAdmin
        ? {}
        : { adminId: String(adminResult.admin._id) },
    ).sort({ createdAt: -1 });
    const owners = await Admin.find(
      { _id: { $in: [...new Set(apiKeys.map((key) => key.adminId))] } },
      "userId",
    ).lean();
    const ownerNames = new Map(owners.map((owner) => [String(owner._id), owner.userId]));

    const apiKeysWithUsage = await Promise.all(
      apiKeys.map(async (key) => ({
        _id: key._id,
        adminId: key.adminId,
        ownerUserId: ownerNames.get(key.adminId) || "Deleted admin",
        name: key.name,
        senderUserId: key.senderUserId,
        permissions: key.permissions,
        lastUsed: key.lastUsed,
        expiresAt: key.expiresAt,
        isActive: key.isActive,
        createdAt: key.createdAt,
        sentCount: await Message.countDocuments({
          apiKeyId: String(key._id),
        }),
      })),
    );

    return NextResponse.json({ apiKeys: apiKeysWithUsage });
  } catch (error: unknown) {
    console.error("[api/admin/api-keys] Failed to fetch API keys:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status },
      );
    }

    await connectDB();
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
    const parsedBody = createApiKeySchema.safeParse(requestBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message || "Invalid API key settings" },
        { status: 400 },
      );
    }
    const { name, expiresDays, senderUserId, adminId: requestedAdminId } =
      parsedBody.data;

    const ownerAdminId =
      adminResult.admin.isSuperAdmin && requestedAdminId
        ? requestedAdminId
        : String(adminResult.admin._id);
    if (adminResult.admin.isSuperAdmin && requestedAdminId) {
      if (!Types.ObjectId.isValid(ownerAdminId)) {
        return NextResponse.json(
          { error: "Admin workspace not found" },
          { status: 404 },
        );
      }
      const ownerExists = await Admin.exists({ _id: ownerAdminId });
      if (!ownerExists) {
        return NextResponse.json(
          { error: "Admin workspace not found" },
          { status: 404 },
        );
      }
    }

    const existingKeys = await ApiKey.find({
      adminId: ownerAdminId,
    })
      .select("keySlot")
      .lean();
    if (existingKeys.length >= 3) {
      return NextResponse.json(
        { error: "The maximum of 3 API keys has been reached. Delete a key before creating another." },
        { status: 409 },
      );
    }

    const occupiedSlots = new Set(
      existingKeys
        .map((key) => key.keySlot)
        .filter(
          (slot): slot is number =>
            typeof slot === "number" && slot >= 1 && slot <= 3,
        ),
    );
    for (const key of existingKeys) {
      if (typeof key.keySlot === "number" && key.keySlot >= 1 && key.keySlot <= 3) {
        continue;
      }
      const legacySlot = [1, 2, 3].find((slot) => !occupiedSlots.has(slot));
      if (legacySlot !== undefined) occupiedSlots.add(legacySlot);
    }
    const keySlot = [1, 2, 3].find((slot) => !occupiedSlots.has(slot));
    if (keySlot === undefined) {
      return NextResponse.json(
        { error: "The maximum of 3 API keys has been reached. Delete a key before creating another." },
        { status: 409 },
      );
    }

    if (senderUserId) {
      const senderQuery: Record<string, unknown> = {
        _id: new Types.ObjectId(senderUserId),
      };
      if (!adminResult.admin.isSuperAdmin) {
        senderQuery.createdByAdminId = ownerAdminId;
      }
      const sender = await User.exists(senderQuery);
      if (!sender) {
        return NextResponse.json({ error: "Sender account not found" }, { status: 400 });
      }
    }

    const apiKey = new ApiKey({
      adminId: ownerAdminId,
      keySlot,
      senderUserId: senderUserId ? String(senderUserId) : undefined,
      name,
      expiresAt: expiresDays
        ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000)
        : undefined,
    });

    const rawKey = await apiKey.generateHash();
    await apiKey.save();

    return NextResponse.json({
      success: true,
      apiKey: {
        _id: apiKey._id,
        keySlot: apiKey.keySlot,
        name: apiKey.name,
        senderUserId: apiKey.senderUserId,
        key: rawKey,
        permissions: apiKey.permissions,
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
      const duplicateError = error as {
        keyPattern?: Record<string, unknown>;
      };
      if (duplicateError.keyPattern?.keySlot) {
        console.error(
          "[api/admin/api-keys] API key slot collision while creating key:",
          error,
        );
        return NextResponse.json(
          { error: "Another API key was created at the same time. Please retry." },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: "The maximum of 3 API keys has been reached. Delete a key before creating another." },
        { status: 409 },
      );
    }
    console.error("[api/admin/api-keys] Failed to create API key:", error);
    if (
      error &&
      typeof error === "object" &&
      "name" in error &&
      error.name === "ValidationError" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }
}
