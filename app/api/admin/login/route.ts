import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import cookie from "cookie";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const { identifier, password } = body;

    console.log("Admin login attempt, identifier:", identifier);

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Identifier and password are required" },
        { status: 400 }
      );
    }

    const admin = await Admin.findOne({
      $or: [{ userId: identifier }, { email: identifier.toLowerCase() }],
    });

    console.log("Found admin:", admin ? admin.userId : "none");

    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isPasswordValid = await admin.comparePassword(password);
    console.log("Password valid:", isPasswordValid);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const sessionData = JSON.stringify({
      adminId: admin._id,
      userId: admin.userId,
      email: admin.email,
      isSuperAdmin: admin.isSuperAdmin,
    });

    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin._id,
        userId: admin.userId,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
      },
    });

    response.headers.set(
      "Set-Cookie",
      cookie.serialize("admin_session", sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      })
    );

    return response;
  } catch (error: any) {
    console.error("Admin login error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
