import { NextRequest, NextResponse } from "next/server";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";
import { connectDB } from "@/lib/db/db";
import { mailFrom, sendMail } from "@/lib/mailer";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import {
  createOtpChallenge,
  invalidateOtpChallenge,
} from "@/lib/auth/otpChallenge";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile = normalizeIndianMobile(body?.mobile);

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
        { status: 400 },
      );
    }

    const scopes = getAuthRateLimitScopes(req, mobile);
    const rateLimit = await consumeAuthRateLimits("login-otp", [
      { scope: scopes.target, limit: 3, windowSeconds: 15 * 60 },
      { scope: scopes.ip, limit: 20, windowSeconds: 15 * 60 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many login code requests. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    await connectDB();

    const user = await User.findOne({ mobile });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not registered. Please create an account first.",
          notRegistered: true,
        },
        { status: 404 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No email registered. Please update your profile or contact support.",
        },
        { status: 400 },
      );
    }

    const email = user.email;
    const { challengeId, otp } = await createOtpChallenge(mobile, "login");

    const template = buildOtpEmailTemplate(user.name || "User", otp);

    try {
      await sendMail({
        from: mailFrom(),
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (emailError) {
      console.error(
        "[auth/login] OTP email could not be sent:",
        emailError instanceof Error ? emailError.message : emailError,
      );
      try {
        await invalidateOtpChallenge(challengeId);
      } catch (cleanupError) {
        console.error(
          "[auth/login] Failed to invalidate undelivered OTP:",
          cleanupError instanceof Error ? cleanupError.message : cleanupError,
        );
      }
      return NextResponse.json(
        {
          success: false,
          error: "We couldn't send your login code right now. Please try again.",
        },
        { status: 503 },
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "OTP sent successfully to your email",
      email,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession({
        challengeId,
        exp: Date.now() + 5 * 60 * 1000,
      }),
      authOtpCookieOptions,
    );

    return response;
  } catch (error: unknown) {
    console.error("Login Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process login",
      },
      { status: 500 },
    );
  }
}
