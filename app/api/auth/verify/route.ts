import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

interface OtpSessionPayload {
  mobile: string;
  hash: string;
  salt: string;
  exp: number;
}

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
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "OTP session not found" },
        { status: 403 },
      );
    }

    let payload: OtpSessionPayload;
    try {
      payload = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid OTP session format" },
        { status: 400 },
      );
    }

    if (!payload.mobile || !payload.hash || !payload.salt || !payload.exp) {
      return NextResponse.json(
        { success: false, error: "Malformed OTP session" },
        { status: 400 },
      );
    }

    if (Date.now() > payload.exp) {
      const response = NextResponse.json(
        { success: false, error: "OTP expired" },
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

    const generatedHash = crypto
      .createHash("sha256")
      .update(code + payload.salt)
      .digest("hex");

    if (generatedHash !== payload.hash) {
      const response = NextResponse.json(
        { success: false, error: "Incorrect OTP" },
        { status: 401 },
      );
      response.cookies.delete("otp_session");
      return response;
    }

    await connectDB();

    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.create({ mobile });
    }

    const sessionData = JSON.stringify({ id: user._id.toString(), mobile });

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile,
    });

    response.cookies.delete("otp_session");

    response.cookies.set("user_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("OTP Verify Error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 },
    );
  }
}
