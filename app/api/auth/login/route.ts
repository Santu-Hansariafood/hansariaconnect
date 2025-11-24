import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile: string = String(body?.mobile || "");

    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.createHash("sha256").update(otp + salt).digest("hex");

    const payload = {
      mobile,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000,
    };

    const response = NextResponse.json({
      success: true,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set("otp_session", JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 60,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Malformed or invalid request" },
      { status: 400 }
    );
  }
}
