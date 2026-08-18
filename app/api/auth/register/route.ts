import { NextRequest, NextResponse } from "next/server";
import { digestHex, randomBytesHex } from "@/lib/crypto";
import { buildOtpEmailTemplate } from "@/lib/emailTemplates";

export const runtime = "nodejs";
import nodemailer from "nodemailer";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import { signOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const ALLOWED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)$/i;

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
    const rawName = String(body?.name || "").trim();
    const name = rawName;
    const email = String(body?.email || "").trim().toLowerCase();
    const mobile = String(body?.mobile || "").trim();
    const { sex, dateOfBirth, termsAccepted } = body;

    if (!rawName || !email || !mobile || !sex || !dateOfBirth || !termsAccepted) {
      return NextResponse.json(
        { success: false, error: "All fields are required" },
        { status: 400 },
      );
    }

    if (!INDIAN_MOBILE_REGEX.test(mobile)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid Indian mobile number" },
        { status: 400 },
      );
    }

    if (!ALLOWED_EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only Gmail, Outlook, and Hansaria Food email addresses are allowed",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const existingUser = await User.findOne({
      $or: [{ mobile }, { email }],
    });

    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User with this mobile or email already exists",
        },
        { status: 400 },
      );
    }

    const otp = generateOtp();

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[REGISTER OTP] Mobile: ${mobile}, Email: ${email}, OTP: ${otp}`,
      );
    }

    const template = buildOtpEmailTemplate(name, otp);

    try {
      await transporter.sendMail({
        from:
          process.env.SMTP_FROM || process.env.EMAIL_FROM ||
          process.env.EMAIL_USER || "no-reply@hansariaconnect.com",
        to: email,
        subject: template.subject,
        text: template.text,
        html: template.html,
      });
    } catch (emailError) {
      console.error("Email send error:", emailError);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send OTP email. Please check your email address and SMTP configuration.",
        },
        { status: 500 },
      );
    }

    const user = await User.create({
      name: rawName,
      email,
      mobile,
      sex,
      dateOfBirth: new Date(dateOfBirth),
      termsAccepted,
    });

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
      message: "Registration successful, OTP sent to email",
      devOtp: process.env.NODE_ENV !== "production" ? otp : undefined,
    });

    response.cookies.set(
      "otp_session",
      await signOtpSession(payload),
      authOtpCookieOptions,
    );

    return response;
  } catch (error: any) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to register", details: error.message },
      { status: 500 },
    );
  }
}
