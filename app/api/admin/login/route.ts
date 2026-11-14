import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { signAdminSession, getAdminSessionCookieOptions } from "@/lib/sessionAuth";

export async function POST(req: NextRequest) {
  try {
    await connectDB();
    const body = await req.json();
    const identifier =
      typeof body?.identifier === "string" ? body.identifier.trim() : "";
    const password =
      typeof body?.password === "string" ? body.password : "";

    if (!identifier || !password) {
      return NextResponse.json(
        { success: false, error: "Identifier and password are required" },
        { status: 400 },
      );
    }

    const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    let admin = await Admin.findOne({
      $or: [
        { userId: { $regex: `^${escapedIdentifier}$`, $options: "i" } },
        { email: identifier.toLowerCase() },
      ],
    });

    const configuredSuperAdminEmail =
      process.env.INITIAL_SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const configuredSuperAdminUserId =
      process.env.INITIAL_SUPER_ADMIN_USER_ID?.trim();
    if (
      !admin &&
      configuredSuperAdminEmail &&
      configuredSuperAdminEmail === identifier.toLowerCase() &&
      configuredSuperAdminUserId
    ) {
      const escapedSuperAdminUserId = configuredSuperAdminUserId.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&",
      );
      const configuredSuperAdmin = await Admin.findOne({
        userId: { $regex: `^${escapedSuperAdminUserId}$`, $options: "i" },
      });
      if (configuredSuperAdmin?.isSuperAdmin) {
        admin = configuredSuperAdmin;
      }
    }

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

    if (/^super\./i.test(req.headers.get("host") || "") && !admin.isSuperAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Only super admins can access this subdomain",
        },
        { status: 403 },
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
      getAdminSessionCookieOptions(req),
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
