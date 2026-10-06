import { NextRequest, NextResponse } from "next/server";
import { randomBytesHex } from "@/lib/crypto";
import { connectDB } from "@/lib/db/db";
import ScanLogin from "@/models/auth/ScanLogin";

export const runtime = "nodejs";

export async function POST() {
  try {
    const token = await randomBytesHex(32);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await connectDB();
    await ScanLogin.deleteMany({ expiresAt: { $lte: new Date() } });
    await ScanLogin.create({ token, expiresAt });

    return NextResponse.json({
      success: true,
      token,
      expiresIn: 5 * 60,
    });
  } catch (error) {
    console.error("Generate Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate scan token" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return NextResponse.json(
        { success: false, error: "Valid token required" },
        { status: 400 },
      );
    }

    await connectDB();
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

    return NextResponse.json(
      {
        success: true,
        ready: Boolean(scanData.mobile) && !scanData.used,
        used: scanData.used,
      },
    );
  } catch (error) {
    console.error("Check Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check login token" },
      { status: 500 },
    );
  }
}
