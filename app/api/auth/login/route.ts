import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const client = twilio(accountSid, authToken);

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile: string = String(body?.mobile || "");

    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
        { status: 400 },
      );
    }

    const otp = generateOtp();

    if (process.env.NODE_ENV !== "production") {
      console.log(`[LOGIN OTP] Mobile: ${mobile}, OTP: ${otp}`);
    }

    const toNumber = `+91${mobile}`;

    try {
      await client.messages.create({
        body: `Your OTP is: ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: toNumber,
      });
    } catch (error) {
      console.error("Twilio Error:", error);
    }

    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto
      .createHash("sha256")
      .update(otp + salt)
      .digest("hex");

    const payload = {
      mobile,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000,
    };

    const response = NextResponse.json({
      success: true,
      message: "OTP sent successfully",
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
  } catch (error: any) {
    console.error("Twilio Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send OTP", details: error.message },
      { status: 500 },
    );
  }
}
