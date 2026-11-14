import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { requireAdmin } from "@/lib/adminAuth";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import Profile from "@/models/profile/Profile";
import User from "@/models/user/User";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const requestedAdminId =
      req.nextUrl.searchParams.get("adminId")?.trim() || String(auth.admin._id);
    if (!Types.ObjectId.isValid(requestedAdminId)) {
      return NextResponse.json({ error: "Invalid admin ID" }, { status: 400 });
    }
    if (
      !auth.admin.isSuperAdmin &&
      requestedAdminId !== String(auth.admin._id)
    ) {
      return NextResponse.json(
        { error: "You can only view sender accounts in your workspace" },
        { status: 403 },
      );
    }

    await connectDB();
    const owner = await Admin.findById(requestedAdminId, "userId").lean();
    if (!owner) {
      return NextResponse.json(
        { error: "Admin workspace not found" },
        { status: 404 },
      );
    }

    const users = await User.find(
      {
        $or: [
          { createdByAdminId: requestedAdminId },
          { createdByAdminId: null },
        ],
      },
      "_id name createdByAdminId",
    )
      .sort({ name: 1, mobile: 1 })
      .lean();
    const userIds = users.map((user) => user._id);
    const profiles = await Profile.find(
      { userId: { $in: userIds } },
      "userId name",
    ).lean();
    const profileNames = new Map(
      profiles.map((profile) => [String(profile.userId), profile.name]),
    );

    return NextResponse.json({
      accounts: users.map((user) => ({
        id: String(user._id),
        name:
          profileNames.get(String(user._id)) ||
          user.name ||
          `Account ${String(user._id).slice(-6)}`,
        adminId: user.createdByAdminId ? String(user.createdByAdminId) : "",
      })),
    });
  } catch (error: unknown) {
    console.error("[api/admin/sender-accounts] Failed to load accounts:", error);
    return NextResponse.json(
      { error: "Failed to load sender accounts" },
      { status: 500 },
    );
  }
}
