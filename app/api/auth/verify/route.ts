import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { digestHex, randomBytesHex } from "@/lib/crypto";
import {
  signUserSession,
  verifyOtpSession,
  authOtpCookieOptions,
  userSessionCookieOptions,
  addUserSession,
} from "@/lib/sessionAuth";
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

    if (payload.mobile !== mobile) {
      return NextResponse.json(
        { success: false, error: "Mobile number mismatch" },
        { status: 403 },
      );
    }

    const generatedHash = await digestHex("SHA-256", code + payload.salt);

    if (generatedHash !== payload.hash) {
      const response = NextResponse.json(
        { success: false, error: "Incorrect OTP" },
        { status: 401 },
      );
      response.cookies.delete("otp_session");
      return response;
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
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const allowed = await addUserSession(
      user._id.toString(),
      sessionId,
      userAgent,
      ip,
    );
    if (!allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error:
            "Maximum active logins reached. Sign out from another device and try again.",
        },
        { status: 403 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    try {
      await User.findByIdAndUpdate(user._id, {
        $set: { lastLoginIp: ip ?? null, lastLoginAt: new Date() },
      });
    } catch (e) {
      console.error("Failed to update last login info", e);
    }

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile,
      name: user.name || "",
      photo: user.photo || (user as any).avatar || "",
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
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
