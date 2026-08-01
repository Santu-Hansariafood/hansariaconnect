import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import {
  verifyAdminOtpSession,
  signAdminSession,
  adminSessionCookieOptions,
} from "@/lib/sessionAuth";

const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .toLowerCase()
      .trim();
    const code = String(body?.code || "").trim();
    if (!email || !ADMINS.has(email)) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid code" },
        { status: 400 },
      );
    }
    const sessionCookie = req.cookies.get("admin_otp_session")?.value;
    const payload = verifyAdminOtpSession(sessionCookie);
    if (!payload) {
      const res = NextResponse.json(
        { success: false, error: "Invalid or expired admin session" },
        { status: 403 },
      );
      res.cookies.delete("admin_otp_session");
      return res;
    }
    if (payload.email !== email) {
      return NextResponse.json(
        { success: false, error: "Email mismatch" },
        { status: 403 },
      );
    }
    const hash = crypto
      .createHash("sha256")
      .update(code + payload.salt)
      .digest("hex");
    if (hash !== payload.hash) {
      const res = NextResponse.json(
        { success: false, error: "Incorrect code" },
        { status: 401 },
      );
      res.cookies.delete("admin_otp_session");
      return res;
    }

    await connectDB();
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 403 },
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.delete("admin_otp_session");
    response.cookies.set(
      "admin_session",
      signAdminSession({
        adminId: admin._id.toString(),
        userId: admin.userId,
        email: admin.email,
        isSuperAdmin: admin.isSuperAdmin,
      }),
      adminSessionCookieOptions,
    );
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
