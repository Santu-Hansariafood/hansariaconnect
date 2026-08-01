import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { getScanToken, setScanToken } from "../generate/route";
import { randomBytesHex } from "@/lib/crypto";
import {
  signUserSession,
  userSessionCookieOptions,
  addUserSession,
} from "@/lib/sessionAuth";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token;

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Token required" },
        { status: 400 },
      );
    }

    const scanData = getScanToken(token);
    if (!scanData) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 404 },
      );
    }

    if (Date.now() - scanData.createdAt > 5 * 60 * 1000) {
      return NextResponse.json(
        { success: false, error: "Token expired" },
        { status: 403 },
      );
    }

    if (scanData.used || !scanData.mobile) {
      return NextResponse.json(
        { success: false, error: "Token not ready or already used" },
        { status: 403 },
      );
    }

    await connectDB();

    let user = await User.findOne({ mobile: scanData.mobile });
    if (!user) {
      user = await User.create({ mobile: scanData.mobile });
    }

    const sessionId = await randomBytesHex(16);
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const ip = req.headers.get("x-forwarded-for") ?? undefined;
    const allowed = await addUserSession(user._id.toString(), sessionId, userAgent, ip);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum active logins reached. Sign out from another device and try again.",
        },
        { status: 403 },
      );
    }

    setScanToken(token, { ...scanData, used: true });

    // update last login info
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
      mobile: scanData.mobile,
    });

    response.cookies.set(
      "user_session",
      await signUserSession({ id: user._id.toString(), sessionId, mobile: scanData.mobile }),
      userSessionCookieOptions,
    );

    return response;
  } catch (error) {
    console.error("Verify Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify token" },
      { status: 500 },
    );
  }
}
