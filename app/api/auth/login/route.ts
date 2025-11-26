// import { NextRequest, NextResponse } from "next/server";
// import crypto from "crypto";

// const generateOtp = (): string =>
//   Math.floor(100000 + Math.random() * 900000).toString();

// export async function POST(req: NextRequest): Promise<NextResponse> {
//   try {
//     const body = await req.json();
//     const mobile: string = String(body?.mobile || "");

//     if (!/^\d{10}$/.test(mobile)) {
//       return NextResponse.json(
//         { success: false, error: "Invalid mobile number" },
//         { status: 400 }
//       );
//     }

//     const otp = generateOtp();
//     const salt = crypto.randomBytes(16).toString("hex");
//     const hash = crypto.createHash("sha256").update(otp + salt).digest("hex");

//     const payload = {
//       mobile,
//       hash,
//       salt,
//       exp: Date.now() + 5 * 60 * 1000,
//     };

//     const response = NextResponse.json({
//       success: true,
//       devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
//     });

//     response.cookies.set("otp_session", JSON.stringify(payload), {
//       httpOnly: true,
//       secure: process.env.NODE_ENV === "production",
//       sameSite: "lax",
//       path: "/",
//       maxAge: 5 * 60,
//     });

//     return response;
//   } catch (error) {
//     return NextResponse.json(
//       { success: false, error: "Malformed or invalid request" },
//       { status: 400 }
//     );
//   }
// }


import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import twilio from "twilio";

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

// Initialize Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

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

    // ----------- Hash OTP + Create Salt ----------
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.createHash("sha256").update(otp + salt).digest("hex");

    const payload = {
      mobile,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000, // expires in 5 mins
    };

    // ----------- SEND OTP USING TWILIO ----------
    try {
      await client.messages.create({
        body: `Your OTP is ${otp}. It will expire in 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: `+91${mobile}`, // India number format
      });
    } catch (twilioErr) {
      console.error("Twilio Error:", twilioErr);
      return NextResponse.json(
        { success: false, error: "Failed to send OTP via SMS" },
        { status: 500 }
      );
    }

    // ----------- Set Cookie ----------
    const response = NextResponse.json({
      success: true,
      message: "OTP sent successfully!",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set("otp_session", JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 5 * 60, // 5 minutes
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Malformed or invalid request" },
      { status: 400 }
    );
  }
}
