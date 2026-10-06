import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import ScanLogin from "@/models/auth/ScanLogin";
import { randomBytesHex } from "@/lib/crypto";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";
import {
  signUserSession,
  userSessionCookieOptions,
  addUserSession,
  getDeviceMetadata,
} from "@/lib/sessionAuth";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token;

    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { success: false, error: "Valid token required" },
        { status: 400 },
      );
    }

    await connectDB();
    const scanData = await ScanLogin.findOneAndUpdate(
      {
        token,
        expiresAt: { $gt: new Date() },
        used: false,
        mobile: { $exists: true },
      },
      { $set: { used: true } },
      { new: true },
    );
    if (!scanData?.mobile) {
      return NextResponse.json(
        { success: false, error: "Token not ready or already used" },
        { status: 403 },
      );
    }

    const user = await User.findOne({ mobile: scanData.mobile });
    if (!user) {
      await ScanLogin.updateOne({ token, used: true }, { $set: { used: false } });
      return NextResponse.json(
        { success: false, error: "The account approving this login no longer exists" },
        { status: 404 },
      );
    }

    const sessionId = await randomBytesHex(16);
    const device = getDeviceMetadata(req);
    const allowed = await addUserSession(
      user._id.toString(),
      sessionId,
      device,
    );
    if (!allowed) {
      await ScanLogin.updateOne({ token, used: true }, { $set: { used: false } });
      return NextResponse.json(
        {
          success: false,
          error: `Maximum of ${MAX_DEVICE_SESSIONS} devices reached. Remove a linked device and try again.`,
          deviceLimitReached: true,
        },
        { status: 409 },
      );
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
      mobile: scanData.mobile,
      name: user.name || "",
      photo: user.photo || (user as { avatar?: string }).avatar || "",
      email: user.email || "",
    });

    response.cookies.set(
      "user_session",
      await signUserSession({
        id: user._id.toString(),
        sessionId,
        mobile: scanData.mobile,
      }),
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
