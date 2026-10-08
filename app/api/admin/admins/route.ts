import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { requireSuperAdmin } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    await connectDB();
    const admins = await Admin.find({}, { password: 0 });
    return NextResponse.json({ success: true, admins });
  } catch (error: unknown) {
    console.error("Get admins error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    await connectDB();
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Request body must be valid JSON" },
        { status: 400 },
      );
    }
    const userId =
      typeof body === "object" && body !== null && "userId" in body &&
      typeof body.userId === "string"
        ? body.userId.trim()
        : "";
    const email =
      typeof body === "object" && body !== null && "email" in body &&
      typeof body.email === "string"
        ? body.email.trim().toLowerCase()
        : "";
    const password =
      typeof body === "object" && body !== null && "password" in body &&
      typeof body.password === "string"
        ? body.password
        : "";
    const isSuperAdmin =
      typeof body === "object" && body !== null && "isSuperAdmin" in body
        ? body.isSuperAdmin
        : false;

    if (
      !/^[a-zA-Z0-9._-]{3,40}$/.test(userId) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      Buffer.byteLength(password, "utf8") > 72 ||
      typeof isSuperAdmin !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter an Admin ID (3–40 letters, numbers, dots, underscores or hyphens), a valid email, and a password of 8–72 UTF-8 bytes",
        },
        { status: 400 },
      );
    }

    const existingAdmin = await Admin.findOne({
      $or: [{ userId }, { email }],
    });

    if (existingAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin ID or email already exists" },
        { status: 409 },
      );
    }

    const newAdmin = new Admin({
      userId,
      email,
      password,
      isSuperAdmin,
    });

    await newAdmin.save();

    const adminWithoutPassword = {
      _id: newAdmin._id,
      userId: newAdmin.userId,
      email: newAdmin.email,
      isSuperAdmin: newAdmin.isSuperAdmin,
      companyName: newAdmin.companyName,
      companyDomain: newAdmin.companyDomain,
      companyVerificationRequested: newAdmin.companyVerificationRequested,
      isCompanyVerified: newAdmin.isCompanyVerified,
      createdAt: newAdmin.createdAt,
      updatedAt: newAdmin.updatedAt,
    };
    return NextResponse.json(
      { success: true, admin: adminWithoutPassword },
      { status: 201 },
    );
  } catch (error: unknown) {
    console.error("Create admin error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return NextResponse.json(
        { success: false, error: "Admin ID or email already exists" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
