import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import type { IUserSessionRecord } from "@/models/user/User";
import {
  getUserSession,
  userSessionCookieOptions,
} from "@/lib/sessionAuth";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    await connectDB();
    const user = await User.findById(session.id).select(
      "_id name email mobile photo avatar sessions",
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 401 },
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        photo: user.photo || (user as { avatar?: string }).avatar,
        maxDevices: MAX_DEVICE_SESSIONS,
        devices: ((user.sessions || []) as IUserSessionRecord[])
          .filter(
            (device) =>
              typeof device.createdAt === "number" &&
              Date.now() - device.createdAt <
                userSessionCookieOptions.maxAge * 1000,
          )
          .map((device) => ({
            sessionId: device.sessionId,
            browserName: device.browserName || "Unknown browser",
            deviceName: device.deviceName || "Unknown device",
            createdAt: device.createdAt,
            current: device.sessionId === session.sessionId,
          })),
      },
    });
  } catch (error: unknown) {
    console.error("Auth me error:", error);
    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 },
    );
  }
}
