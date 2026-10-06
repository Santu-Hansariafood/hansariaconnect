import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/request";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import ScanLogin from "@/models/auth/ScanLogin";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";
import type { IUserSessionRecord } from "@/models/user/User";
import { userSessionCookieOptions } from "@/lib/sessionAuth";

export async function POST(req: NextRequest) {
  try {
    const session = await requireUser(req);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "Sign in on the scanning device first" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const token = String(body?.token || "");

    if (!/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { success: false, error: "Invalid token" },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await User.findById(session.id).select("mobile sessions");
    if (!user?.mobile) {
      return NextResponse.json(
        { success: false, error: "Could not identify the signed-in account" },
        { status: 401 },
      );
    }

    const scanData = await ScanLogin.findOne({
      token,
      expiresAt: { $gt: new Date() },
    }).lean();
    if (!scanData) {
      return NextResponse.json(
        { success: false, error: "Invalid or expired token" },
        { status: 404 },
      );
    }

    if (scanData.used) {
      return NextResponse.json(
        { success: false, error: "Token already used" },
        { status: 403 },
      );
    }

    if (scanData.mobile && scanData.mobile !== user.mobile) {
      return NextResponse.json(
        { success: false, error: "This login QR was approved by another account" },
        { status: 403 },
      );
    }

    const activeSessions = ((user.sessions || []) as IUserSessionRecord[]).filter(
      (device) =>
        typeof device.createdAt === "number" &&
        Date.now() - device.createdAt < userSessionCookieOptions.maxAge * 1000,
    );
    if (activeSessions.length >= MAX_DEVICE_SESSIONS) {
      return NextResponse.json(
        {
          success: false,
          error: `You already have ${MAX_DEVICE_SESSIONS} linked devices. Remove one before linking another.`,
          deviceLimitReached: true,
        },
        { status: 409 },
      );
    }

    const linkedScan = await ScanLogin.findOneAndUpdate(
      {
        token,
        expiresAt: { $gt: new Date() },
        used: false,
        $or: [{ mobile: { $exists: false } }, { mobile: user.mobile }],
      },
      { $set: { mobile: user.mobile } },
      { new: true },
    );
    if (!linkedScan) {
      return NextResponse.json(
        { success: false, error: "This login QR is no longer available" },
        { status: 409 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Link Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to link token" },
      { status: 500 },
    );
  }
}
