import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { signAdminSession, adminSessionCookieOptions } from "@/lib/sessionAuth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Identifier and password are required" },
        { status: 400 },
      );
    }

    const admin = await Admin.findOne({
      $or: [{ userId: identifier }, { email: identifier.toLowerCase() }],
    });

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin._id,
        userId: admin.userId,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
      },
    });

    response.cookies.set(
      "admin_session",
      await signAdminSession({
        adminId: admin._id.toString(),
        userId: admin.userId,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
      }),
      adminSessionCookieOptions,
    );

    return response;
  } catch (error: unknown) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
