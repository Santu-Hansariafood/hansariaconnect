import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import {
  verifyAdminOtpSession,
  signAdminSession,
  adminSessionCookieOptions,
} from "@/lib/sessionAuth";
import { consumeOtpChallenge } from "@/lib/auth/otpChallenge";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";

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
    const scopes = getAuthRateLimitScopes(req, email);
    const rateLimit = await consumeAuthRateLimits("admin-verify-otp", [
      { scope: scopes.target, limit: 10, windowSeconds: 15 * 60 },
      { scope: scopes.ip, limit: 30, windowSeconds: 15 * 60 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many verification attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const sessionCookie = req.cookies.get("admin_otp_session")?.value;
    const payload = await verifyAdminOtpSession(sessionCookie);
    if (!payload) {
      const res = NextResponse.json(
        { success: false, error: "Invalid or expired admin session" },
        { status: 403 },
      );
      res.cookies.delete("admin_otp_session");
      return res;
    }
    const validCode = await consumeOtpChallenge(
      payload.challengeId,
      email,
      ["admin"],
      code,
    );
    if (!validCode) {
      return NextResponse.json(
        { success: false, error: "Incorrect code" },
        { status: 401 },
      );
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
    console.error("[admin/verify-otp] Verification failed:", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
