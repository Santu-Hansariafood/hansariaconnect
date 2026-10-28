import { NextRequest, NextResponse, after } from "next/server";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";
import { connectDB } from "@/lib/db/db";
import { mailFrom, sendMail } from "@/lib/mailer";
import Admin from "@/models/admin/Admin";
import { signAdminOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";
import { createOtpChallenge } from "@/lib/auth/otpChallenge";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";

export const runtime = "nodejs";
const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"]);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .toLowerCase()
      .trim();
    if (!email || !ADMINS.has(email)) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }

    const scopes = getAuthRateLimitScopes(req, email);
    const rateLimit = await consumeAuthRateLimits("admin-otp", [
      { scope: scopes.target, limit: 5, windowSeconds: 15 * 60 },
      { scope: scopes.ip, limit: 15, windowSeconds: 15 * 60 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many verification code requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    await connectDB();
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }

    const { challengeId, otp } = await createOtpChallenge(email, "admin");
    const template = buildOtpEmailTemplate("Administrator", otp, "admin");

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      "admin_otp_session",
      await signAdminOtpSession({
        challengeId,
        exp: Date.now() + 5 * 60 * 1000,
      }),
      authOtpCookieOptions,
    );

    // Reply first: the admin is waiting on this request, not on the mail server.
    after(async () => {
      try {
        await sendMail({
          from: mailFrom(),
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });
      } catch (error) {
        console.error(
          "[admin/request-otp] OTP email could not be sent:",
          error instanceof Error ? error.message : error,
        );
      }
    });

    return response;
  } catch (e: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "Server error",
      },
      { status: 500 },
    );
  }
}
