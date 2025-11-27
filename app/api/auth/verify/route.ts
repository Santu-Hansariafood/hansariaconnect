// import { NextRequest, NextResponse } from "next/server";
// import crypto from "crypto";
// import { connectDB } from "@/lib/db/db";
// import User from "@/models/user/User";

// interface OtpSessionPayload {
//   mobile: string;
//   hash: string;
//   salt: string;
//   exp: number;
// }

// export async function POST(req: NextRequest): Promise<NextResponse> {
//   try {
//     const body = await req.json();
//     const mobile: string = String(body?.mobile || "");
//     const code: string = String(body?.code || "");

//     if (!/^\d{10}$/.test(mobile)) {
//       return NextResponse.json(
//         { success: false, error: "Invalid mobile number" },
//         { status: 400 }
//       );
//     }

//     if (!/^\d{6}$/.test(code)) {
//       return NextResponse.json(
//         { success: false, error: "Invalid OTP format" },
//         { status: 400 }
//       );
//     }

//     const sessionCookie = req.cookies.get("otp_session")?.value;
//     if (!sessionCookie) {
//       return NextResponse.json(
//         { success: false, error: "OTP session not found" },
//         { status: 400 }
//       );
//     }

//     let payload: OtpSessionPayload;
//     try {
//       payload = JSON.parse(sessionCookie);
//     } catch {
//       return NextResponse.json(
//         { success: false, error: "Invalid OTP session format" },
//         { status: 400 }
//       );
//     }

//     if (!payload?.mobile || !payload?.hash || !payload?.salt || !payload?.exp) {
//       return NextResponse.json(
//         { success: false, error: "Malformed OTP session" },
//         { status: 400 }
//       );
//     }

//     if (Date.now() > Number(payload.exp)) {
//       const response = NextResponse.json(
//         { success: false, error: "OTP expired" },
//         { status: 400 }
//       );
//       response.cookies.delete("otp_session");
//       return response;
//     }

//     if (payload.mobile !== mobile) {
//       return NextResponse.json(
//         { success: false, error: "Mobile number mismatch" },
//         { status: 400 }
//       );
//     }

//     const generatedHash = crypto
//       .createHash("sha256")
//       .update(code + payload.salt)
//       .digest("hex");
//     if (generatedHash !== payload.hash) {
//       return NextResponse.json(
//         { success: false, error: "Incorrect OTP" },
//         { status: 401 }
//       );
//     }

//     await connectDB();

//     let user = await User.findOne({ mobile });
//     if (!user) {
//       user = await User.create({ mobile });
//     }

//     const response = NextResponse.json({
//       success: true,
//       userId: user._id.toString(),
//       mobile,
//     });

//     response.cookies.delete("otp_session");

//     response.cookies.set(
//       "user_session",
//       JSON.stringify({ id: user._id.toString(), mobile }),
//       {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "lax",
//         path: "/",
//         maxAge: 30 * 24 * 60 * 60,
//       }
//     );

//     return response;
//   } catch (error) {
//     console.error(error);
//     return NextResponse.json(
//       { success: false, error: "Invalid request" },
//       { status: 400 }
//     );
//   }
// }



import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

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

    // Validate mobile
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Invalid mobile number" },
        { status: 400 }
      );
    }

    // Validate OTP code
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: "Invalid OTP format" },
        { status: 400 }
      );
    }

    const sessionCookie = req.cookies.get("otp_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: "OTP session not found" },
        { status: 403 }
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

    // Ensure all fields exist
    if (!payload.mobile || !payload.hash || !payload.salt || !payload.exp) {
      return NextResponse.json(
        { success: false, error: "Malformed OTP session" },
        { status: 400 }
      );
    }

    // Expiry check
    if (Date.now() > payload.exp) {
      const response = NextResponse.json(
        { success: false, error: "OTP expired" },
        { status: 403 }
      );
      response.cookies.delete("otp_session");
      return response;
    }

    // Mobile mismatch protection
    if (payload.mobile !== mobile) {
      return NextResponse.json(
        { success: false, error: "Mobile number mismatch" },
        { status: 403 }
      );
    }

    // Validate OTP with hash
    const generatedHash = crypto
      .createHash("sha256")
      .update(code + payload.salt)
      .digest("hex");

    if (generatedHash !== payload.hash) {
      const response = NextResponse.json(
        { success: false, error: "Incorrect OTP" },
        { status: 401 }
      );
      response.cookies.delete("otp_session");
      return response;
    }

    // DB Connect
    await connectDB();

    // Find or create user
    let user = await User.findOne({ mobile });
    if (!user) {
      user = await User.create({ mobile });
    }

    // Encode session to prevent special character issues
    const sessionData = Buffer.from(
      JSON.stringify({ id: user._id.toString(), mobile }),
      "utf8"
    ).toString("base64");

    const response = NextResponse.json({
      success: true,
      userId: user._id.toString(),
      mobile,
    });

    // Remove OTP session cookie
    response.cookies.delete("otp_session");

    // Set user session cookie
    response.cookies.set("user_session", sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (error) {
    console.error("OTP Verify Error:", error);
    return NextResponse.json(
      { success: false, error: "Invalid request" },
      { status: 400 }
    );
  }
}
