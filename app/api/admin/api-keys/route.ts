import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import ApiKey from "@/models/apiKey/ApiKey";
import User from "@/models/user/User";

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
    const apiKeys = await ApiKey.find({ adminId: adminResult.admin._id }).sort({
      createdAt: -1,
    });

    return NextResponse.json({
      apiKeys: apiKeys.map((k) => ({
        _id: k._id,
        name: k.name,
        senderUserId: k.senderUserId,
        permissions: k.permissions,
        lastUsed: k.lastUsed,
        expiresAt: k.expiresAt,
        isActive: k.isActive,
        createdAt: k.createdAt,
      })),
    });
  } catch (error: any) {
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
    const body = await req.json();
    const { name, expiresDays, senderUserId } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (senderUserId) {
      const senderQuery: Record<string, unknown> = { _id: senderUserId };
      if (!adminResult.admin.isSuperAdmin) {
        senderQuery.createdByAdminId = String(adminResult.admin._id);
      }
      const sender = await User.exists(senderQuery);
      if (!sender) {
        return NextResponse.json({ error: "Sender account not found" }, { status: 400 });
      }
    }

    const apiKey = new ApiKey({
      adminId: adminResult.admin._id,
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
        name: apiKey.name,
        senderUserId: apiKey.senderUserId,
        key: rawKey,
        permissions: apiKey.permissions,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 },
    );
  }
}
