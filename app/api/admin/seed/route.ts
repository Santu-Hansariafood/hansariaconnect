import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import bcrypt from "bcrypt";

const DEFAULT_SUPER_ADMIN = {
  userId: process.env.INITIAL_SUPER_ADMIN_USER_ID || "",
  email: process.env.INITIAL_SUPER_ADMIN_EMAIL || "",
  password: process.env.INITIAL_SUPER_ADMIN_PASSWORD || "",
  isSuperAdmin: true,
};

const DEFAULT_ADMIN = {
  userId: process.env.INITIAL_ADMIN_USER_ID || "",
  email: process.env.INITIAL_ADMIN_EMAIL || "",
  password: process.env.INITIAL_ADMIN_PASSWORD || "",
  isSuperAdmin: false,
};

export async function GET(req: NextRequest) {
  try {
    const seedSecret = process.env.ADMIN_SEED_SECRET;
    const suppliedSecret = req.headers.get("x-admin-seed-secret");
    if (!seedSecret || suppliedSecret !== seedSecret) {
      return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
    }

    if (
      !DEFAULT_SUPER_ADMIN.userId ||
      !DEFAULT_SUPER_ADMIN.email ||
      !DEFAULT_SUPER_ADMIN.password ||
      !DEFAULT_ADMIN.userId ||
      !DEFAULT_ADMIN.email ||
      !DEFAULT_ADMIN.password
    ) {
      return NextResponse.json(
        { success: false, error: "Admin seed configuration is incomplete" },
        { status: 503 },
      );
    }

    await connectDB();

    // Get reset flag from query
    const { searchParams } = new URL(req.url);
    const shouldReset = searchParams.get("reset") === "true";

    // Hash passwords manually
    const saltRounds = 10;
    const hashedSuperAdminPassword = await bcrypt.hash(
      DEFAULT_SUPER_ADMIN.password,
      saltRounds,
    );

    const hashedAdminPassword = await bcrypt.hash(
      DEFAULT_ADMIN.password,
      saltRounds,
    );

    if (shouldReset) {
      await Admin.deleteMany({});
    }

    await Admin.findOneAndUpdate(
      {
        $or: [
          { userId: DEFAULT_SUPER_ADMIN.userId },
          { email: DEFAULT_SUPER_ADMIN.email },
        ],
      },
      {
        ...DEFAULT_SUPER_ADMIN,
        password: hashedSuperAdminPassword,
      },
      { upsert: true, new: true },
    );

    await Admin.findOneAndUpdate(
      {
        $or: [{ userId: DEFAULT_ADMIN.userId }, { email: DEFAULT_ADMIN.email }],
      },
      {
        ...DEFAULT_ADMIN,
        password: hashedAdminPassword,
      },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      success: true,
      message: "Default admin users seeded successfully!",
    });
  } catch (error: unknown) {
    console.error("Error seeding admin users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to seed admin users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
