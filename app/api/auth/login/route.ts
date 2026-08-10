import { NextRequest, NextResponse } from "next/server";
import { digestHex, randomBytesHex } from "@/lib/crypto";

export const runtime = "nodejs";
import nodemailer from "nodemailer";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";

const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "587"),
  secure: (process.env.SMTP_SECURE || process.env.EMAIL_SECURE) === "true",
  auth: {
    user: process.env.SMTP_USER || process.env.EMAIL_USER,
    pass: process.env.SMTP_PASS || process.env.EMAIL_PASS,
  },
});

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

    const otp = generateOtp();

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[LOGIN OTP] Mobile: ${mobile}, Email: ${user.email}, OTP: ${otp}`,
      );
    }

    try {
      await transporter.sendMail({
        from:
          process.env.SMTP_FROM ||
          process.env.EMAIL_USER ||
          "no-reply@hansariaconnect.com",
        to: user.email,
        subject: "Your OTP for HansariaConnect",
        text: `Hello ${user.name || "User"},\n\nYour OTP for HansariaConnect is: ${otp}\n\nThis OTP is valid for 5 minutes.\n\nBest regards,\nHansariaConnect Team`,
        html: `<p>Hello ${user.name || "User"},</p><p>Your OTP for HansariaConnect is: <strong>${otp}</strong></p><p>This OTP is valid for 5 minutes.</p><p>Best regards,<br/>HansariaConnect Team</p>`,
      });
    } catch (emailError) {
      console.error("Email send error:", emailError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send OTP email. Please try again.",
        },
        { status: 500 },
      );
    }

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
      email: user.email,
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession(payload),
      authOtpCookieOptions,
    );

    return response;
  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process login",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
