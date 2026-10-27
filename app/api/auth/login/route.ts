import { NextRequest, NextResponse, after } from "next/server";
import { digestHex, randomBytesHex } from "@/lib/crypto";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";
import { connectDB } from "@/lib/db/db";
import { mailFrom, sendMail } from "@/lib/mailer";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const mobile = normalizeIndianMobile(body?.mobile);

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
        { status: 400 },
      );
    }

    await connectDB();

    const user = await User.findOne({ mobile });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not registered. Please create an account first.",
          notRegistered: true,
        },
        { status: 404 },
      );
    }

    if (!user.email) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No email registered. Please update your profile or contact support.",
        },
        { status: 400 },
      );
    }

    const email = user.email;
    const otp = generateOtp();

    const template = buildOtpEmailTemplate(user.name || "User", otp);

    const salt = await randomBytesHex(16);
    const hash = await digestHex("SHA-256", otp + salt);

    const payload = {
      mobile,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000,
    };

    const response = NextResponse.json({
      success: true,
      message: "OTP sent successfully to your email",
      email,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession(payload),
      authOtpCookieOptions,
    );

    // The code is already signed into the cookie, so the reply no longer has to
    // sit through the SMTP handshake. The mail is handed off right after.
    after(async () => {
      try {
        await sendMail({
          from: mailFrom(),
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });
      } catch (emailError) {
        console.error(
          "[auth/login] OTP email could not be sent:",
          emailError instanceof Error ? emailError.message : emailError,
        );
      }
    });

    return response;
  } catch (error: unknown) {
    console.error("Login Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process login",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
