import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

export const runtime = "nodejs"; // Required for Twilio

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const USE_TWILIO = Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_VERIFY_SERVICE_SID);

const client = USE_TWILIO
  ? require("twilio")(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
  : null;

interface OtpSessionPayload {
  mobile: string;
  hash: string;
  salt: string;
  exp: number;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile: string = String(body?.mobile || "");
    const code: string = String(body?.code || "");

    // --- Validate inputs ---
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format" },
        { status: 400 }
      );
    }

    // --- Read OTP session from cookie ---
    const sessionCookie = req.cookies.get("otp_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "OTP session not found" },
        { status: 400 }
      );
    }

    let payload: OtpSessionPayload;
    try {
      payload = JSON.parse(sessionCookie);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid OTP session format" },
        { status: 400 }
      );
    }

    // --- Validate session object ---
    if (!payload.mobile || !payload.hash || !payload.salt || !payload.exp) {
      return NextResponse.json(
        { success: false, error: "Malformed OTP session" },
        { status: 400 }
      );
    }

    // --- Check expiry ---
    if (Date.now() > payload.exp) {
      const res = NextResponse.json(
        { success: false, error: "OTP expired" },
        { status: 400 }
      );
      res.cookies.delete("otp_session");
      return res;
    }

    // --- Check mobile mismatch ---
    if (payload.mobile !== mobile) {
      return NextResponse.json(
        { success: false, error: "Mobile number mismatch" },
        { status: 400 }
      );
    }

    // -------------------------------------------------------------------------
    // TWILIO VERIFY CHECK (if configured)
    // -------------------------------------------------------------------------
    let twilioApproved = false;
    let twilioChecked = false;
    if (USE_TWILIO && client) {
      try {
        const twilioResponse = await client.verify.v2
          .services(TWILIO_VERIFY_SERVICE_SID!)
          .verificationChecks.create({
            to: `+91${mobile}`,
            code,
          });
        twilioChecked = true;
        twilioApproved = twilioResponse.status === "approved";
        if (!twilioApproved) {
          return NextResponse.json(
            { success: false, error: "Incorrect OTP" },
            { status: 401 }
          );
        }
      } catch (err) {
        console.error("Twilio Verify Error:", err);
      }
    }

    if (!USE_TWILIO || !twilioChecked) {
      const generatedHash = crypto
        .createHash("sha256")
        .update(code + payload.salt)
        .digest("hex");

      if (generatedHash !== payload.hash) {
        return NextResponse.json(
          { success: false, error: "Incorrect OTP" },
          { status: 401 }
        );
      }
    }

    await connectDB();

    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.create({ mobile });
    }

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile,
    });

    response.cookies.delete("otp_session");

    response.cookies.set(
      "user_session",
      JSON.stringify({ id: user._id.toString(), mobile }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return response;
  } catch (error) {
    console.error("Verification Error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
