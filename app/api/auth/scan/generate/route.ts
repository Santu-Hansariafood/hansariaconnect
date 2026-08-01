import { NextRequest, NextResponse } from "next/server";
import { randomBytesHex } from "@/lib/crypto";

export const runtime = "nodejs";

const scanTokens = new Map<
  string,
  {
    token: string;
    createdAt: number;
    used: boolean;
    mobile?: string;
  }
>();

setInterval(() => {
  const now = Date.now();
  for (const [key, token] of scanTokens) {
    if (now - token.createdAt > 5 * 60 * 1000) {
      scanTokens.delete(key);
    }
  }
}, 60 * 1000);

export async function POST(req: NextRequest) {
  try {
    const token = await randomBytesHex(32);
    const scanData = {
      token,
      createdAt: Date.now(),
      used: false,
    };

    scanTokens.set(token, scanData);

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
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token required" },
      { status: 400 },
    );
  }

  const scanData = scanTokens.get(token);
  if (!scanData) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 404 },
    );
  }

  if (Date.now() - scanData.createdAt > 5 * 60 * 1000) {
    scanTokens.delete(token);
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

  return NextResponse.json({
    success: true,
    ready: !!scanData.mobile,
    mobile: scanData.mobile,
  });
}

export const getScanToken = (token: string) => scanTokens.get(token);
export const setScanToken = (token: string, data: any) =>
  scanTokens.set(token, data);
