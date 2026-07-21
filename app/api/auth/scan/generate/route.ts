import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// In-memory store for scan tokens (in production, use Redis or MongoDB with TTL)
const scanTokens = new Map<
  string,
  {
    token: string;
    createdAt: number;
    used: boolean;
    mobile?: string;
  }
>();

// Cleanup old tokens (older than 5 minutes)
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
    const token = crypto.randomBytes(32).toString("hex");
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
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json(
      { success: false, error: "Token required" },
      { status: 400 }
    );
  }

  const scanData = scanTokens.get(token);
  if (!scanData) {
    return NextResponse.json(
      { success: false, error: "Invalid token" },
      { status: 404 }
    );
  }

  if (Date.now() - scanData.createdAt > 5 * 60 * 1000) {
    scanTokens.delete(token);
    return NextResponse.json(
      { success: false, error: "Token expired" },
      { status: 403 }
    );
  }

  if (scanData.used) {
    return NextResponse.json(
      { success: false, error: "Token already used" },
      { status: 403 }
    );
  }

  // If token is linked to a mobile, return that it's ready
  return NextResponse.json({
    success: true,
    ready: !!scanData.mobile,
    mobile: scanData.mobile,
  });
}

export const getScanToken = (token: string) => scanTokens.get(token);
export const setScanToken = (token: string, data: any) => scanTokens.set(token, data);
