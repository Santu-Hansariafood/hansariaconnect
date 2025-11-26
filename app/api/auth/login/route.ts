import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import twilio from "twilio";

export const runtime = "nodejs";

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

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    const twilioConfigured = Boolean(accountSid && authToken && serviceSid);

    if (twilioConfigured) {
      try {
        const client = twilio(accountSid as string, authToken as string);
        await client.verify.v2
          .services(serviceSid as string)
          .verifications.create({
            to: `+91${mobile}`,
            channel: "sms",
          });
      } catch (err) {
        console.error("Twilio send error:", err);
      }
    } else {
    }

    return response;
  } catch (error) {
    console.error("OTP Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send OTP" },
      { status: 500 }
    );
  }
}
