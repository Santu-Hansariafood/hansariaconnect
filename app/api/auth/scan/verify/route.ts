import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { getScanToken, setScanToken } from "../generate/route";

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

    setScanToken(token, { ...scanData, used: true });

    const sessionData = JSON.stringify({
      id: user._id.toString(),
      mobile: scanData.mobile,
    });

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile: scanData.mobile,
    });

    response.cookies.set("user_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("Verify Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to verify token" },
      { status: 500 },
    );
  }
}
