import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import bcrypt from "bcrypt";

// Default credentials for initial setup
const DEFAULT_SUPER_ADMIN = {
  userId: "superadmin",
  email: "superadmin@example.com",
  password: "SuperAdmin123!",
  isSuperAdmin: true,
};

const DEFAULT_ADMIN = {
  userId: "admin",
  email: "admin@example.com",
  password: "Admin123!",
  isSuperAdmin: false,
};

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    console.log("Connected to database for seeding admins...");

    // Get reset flag from query
    const { searchParams } = new URL(req.url);
    const shouldReset = searchParams.get("reset") === "true";

    // Hash passwords manually
    const saltRounds = 10;
    const hashedSuperAdminPassword = await bcrypt.hash(DEFAULT_SUPER_ADMIN.password, saltRounds);
    console.log("Hashed super admin password:", hashedSuperAdminPassword);

    const hashedAdminPassword = await bcrypt.hash(DEFAULT_ADMIN.password, saltRounds);
    console.log("Hashed admin password:", hashedAdminPassword);

    if (shouldReset) {
      console.log("Resetting all admin users...");
      await Admin.deleteMany({});
      console.log("All existing admin users deleted!");
    }

    // Upsert super admin
    const superAdminResult = await Admin.findOneAndUpdate(
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
      { upsert: true, new: true }
    );
    console.log("Upserted super admin:", superAdminResult.userId);

    // Upsert regular admin
    const adminResult = await Admin.findOneAndUpdate(
      {
        $or: [
          { userId: DEFAULT_ADMIN.userId },
          { email: DEFAULT_ADMIN.email },
        ],
      },
      {
        ...DEFAULT_ADMIN,
        password: hashedAdminPassword,
      },
      { upsert: true, new: true }
    );
    console.log("Upserted admin:", adminResult.userId);

    // Verify passwords work after upsert
    const testSuperAdmin = await Admin.findOne({ userId: DEFAULT_SUPER_ADMIN.userId });
    if (testSuperAdmin) {
      const testPass = await testSuperAdmin.comparePassword(DEFAULT_SUPER_ADMIN.password);
      console.log("Super admin password test passed?", testPass);
    }
    const testAdmin = await Admin.findOne({ userId: DEFAULT_ADMIN.userId });
    if (testAdmin) {
      const testPass = await testAdmin.comparePassword(DEFAULT_ADMIN.password);
      console.log("Admin password test passed?", testPass);
    }

    return NextResponse.json({
      success: true,
      message: "Default admin users seeded successfully!",
      credentials: {
        superAdmin: {
          userId: DEFAULT_SUPER_ADMIN.userId,
          email: DEFAULT_SUPER_ADMIN.email,
          password: DEFAULT_SUPER_ADMIN.password,
        },
        admin: {
          userId: DEFAULT_ADMIN.userId,
          email: DEFAULT_ADMIN.email,
          password: DEFAULT_ADMIN.password,
        },
      },
    });
  } catch (error: any) {
    console.error("Error seeding admin users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to seed admin users", details: error.message },
      { status: 500 }
    );
  }
}
