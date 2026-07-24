import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import ApiKey from "@/models/apiKey/ApiKey";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status }
      );
    }

    await connectDB();
    const body = await req.json();
    const { isActive } = body;

    const apiKey = await ApiKey.findOne({
      _id: params.id,
      adminId: adminResult.admin._id,
    });

    if (!apiKey) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (typeof isActive === "boolean") {
      apiKey.isActive = isActive;
    }

    await apiKey.save();

    return NextResponse.json({
      success: true,
      apiKey: {
        _id: apiKey._id,
        name: apiKey.name,
        permissions: apiKey.permissions,
        lastUsed: apiKey.lastUsed,
        expiresAt: apiKey.expiresAt,
        isActive: apiKey.isActive,
        createdAt: apiKey.createdAt,
      },
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to update API key" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminResult = await requireAdmin(req);
    if ("error" in adminResult) {
      return NextResponse.json(
        { error: adminResult.error },
        { status: adminResult.status }
      );
    }

    await connectDB();
    await ApiKey.findOneAndDelete({
      _id: params.id,
      adminId: adminResult.admin._id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    );
  }
}
