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

    const adminsToSeed = [DEFAULT_SUPER_ADMIN, DEFAULT_ADMIN].filter(
      (admin) => admin.userId && admin.email && admin.password,
    );

    if (adminsToSeed.length === 0) {
      return NextResponse.json(
        { success: false, error: "No complete admin seed configuration is available" },
        { status: 503 },
      );
    }

    await connectDB();

    // Get reset flag from query
    const { searchParams } = new URL(req.url);
    const shouldReset = searchParams.get("reset") === "true";

    // Hash passwords manually
    const saltRounds = 10;
    if (shouldReset) {
      await Admin.deleteMany({});
    }

    for (const admin of adminsToSeed) {
      const hashedPassword = await bcrypt.hash(admin.password, saltRounds);
      await Admin.findOneAndUpdate(
        {
          $or: [{ userId: admin.userId }, { email: admin.email }],
        },
        {
          ...admin,
          password: hashedPassword,
        },
        { upsert: true, new: true },
      );
    }

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
