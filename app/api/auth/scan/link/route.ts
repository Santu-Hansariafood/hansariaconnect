import { NextRequest, NextResponse } from "next/server";
import { getScanToken, setScanToken } from "../generate/route";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, mobile } = body;

    if (!token || !mobile) {
      return NextResponse.json(
        { success: false, error: "Token and mobile required" },
        { status: 400 },
      );
    }

    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
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

    if (scanData.used) {
      return NextResponse.json(
        { success: false, error: "Token already used" },
        { status: 403 },
      );
    }

    setScanToken(token, { ...scanData, mobile });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Link Scan Token Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to link token" },
      { status: 500 },
    );
  }
}
