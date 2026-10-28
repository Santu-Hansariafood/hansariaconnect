import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { randomBytesHex } from "@/lib/crypto";
import {
  addUserSession,
  signUserSession,
  verifyOtpSession,
  userSessionCookieOptions,
  getDeviceMetadata,
} from "@/lib/sessionAuth";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";
import { consumeOtpChallenge } from "@/lib/auth/otpChallenge";
import {
  consumeAuthRateLimits,
  getAuthRateLimitScopes,
} from "@/lib/auth/authRateLimit";
export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile: string = String(body?.mobile || "");
    const code: string = String(body?.code || "");
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format" },
        { status: 400 },
      );
    }

    const scopes = getAuthRateLimitScopes(req, mobile);
    const rateLimit = await consumeAuthRateLimits("verify-otp", [
      { scope: scopes.target, limit: 10, windowSeconds: 15 * 60 },
      { scope: scopes.ip, limit: 30, windowSeconds: 15 * 60 },
    ]);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Too many verification attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } },
      );
    }

    const sessionCookie = req.cookies.get("otp_session")?.value;
    const payload = await verifyOtpSession(sessionCookie);
    if (!payload) {
      const response = NextResponse.json(
        { success: false, error: "Invalid or expired OTP session" },
        { status: 403 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    const validCode = await consumeOtpChallenge(
      payload.challengeId,
      mobile,
      ["login", "registration"],
      code,
    );
    if (!validCode) {
      return NextResponse.json(
        { success: false, error: "Incorrect OTP" },
        { status: 401 },
      );
    }

    await connectDB();

    const user = await User.findOne({ mobile });
    if (!user) {
      const response = NextResponse.json(
        {
          success: false,
          error: "User not registered. Please create an account first.",
          notRegistered: true,
        },
        { status: 404 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    if (!user.email) {
      const response = NextResponse.json(
        {
          success: false,
          error:
            "No email registered. Please update your profile or contact support.",
        },
        { status: 400 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    const sessionId = await randomBytesHex(16);
    const device = getDeviceMetadata(req);
    const allowed = await addUserSession(
      user._id.toString(),
      sessionId,
      device,
    );
    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: `Maximum of ${MAX_DEVICE_SESSIONS} devices reached. Remove a linked device and try again.`,
          deviceLimitReached: true,
        },
        { status: 409 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    try {
      await User.findByIdAndUpdate(user._id, {
        $set: { lastLoginIp: device.ip ?? null, lastLoginAt: new Date() },
      });
    } catch (e) {
      console.error("Failed to update last login info", e);
    }

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile,
      name: user.name || "",
      photo: user.photo || (user as { avatar?: string }).avatar || "",
      email: user.email || "",
    });

    response.cookies.delete("otp_session");

    response.cookies.set(
      "user_session",
      await signUserSession({ id: user._id.toString(), sessionId, mobile }),
      userSessionCookieOptions,
    );

    return response;
  } catch (error) {
    console.error("OTP Verify Error:", error);
    return NextResponse.json(
      { success: false, error: "Authentication is temporarily unavailable" },
      { status: 500 },
    );
  }
}
