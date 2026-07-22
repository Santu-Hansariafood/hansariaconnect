import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { requireSuperAdmin } from "@/lib/adminAuth";

// Get all admins (super admin only)
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();
    const admins = await Admin.find({}, { password: 0 }); // Exclude password
    return NextResponse.json({ success: true, admins });
  } catch (error: any) {
    console.error("Get admins error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Create new admin (super admin only)
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status }
      );
    }

    await connectDB();
    const body = await req.json();
    const { userId, email, password, isSuperAdmin = false } = body;

    if (!userId || !email || !password) {
      return NextResponse.json(
        { success: false, error: "User ID, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if userId or email already exists
    const existingAdmin = await Admin.findOne({
      $or: [{ userId }, { email }],
    });

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "User ID or email already exists" },
        { status: 400 }
      );
    }

    const newAdmin = new Admin({
      userId,
      email,
      password,
      isSuperAdmin,
    });

    await newAdmin.save();

    // Return without password
    const { password: _, ...adminWithoutPassword } = newAdmin.toObject();
    return NextResponse.json({ success: true, admin: adminWithoutPassword });
  } catch (error: any) {
    console.error("Create admin error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
