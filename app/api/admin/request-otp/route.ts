import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { digestHex, randomBytesHex } from "@/lib/crypto";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { signAdminOtpSession, authOtpCookieOptions } from "@/lib/sessionAuth";

export const runtime = "nodejs";
const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"]);

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const mailTemplate = (otp: string) => `
<div style="font-family: Inter, Arial, sans-serif; background:#f7fafc; padding:24px">
  <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:12px; border:1px solid #edf2f7; overflow:hidden">
    <div style="background:linear-gradient(135deg,#10b981,#34d399); padding:20px 24px; color:#fff">
      <h1 style="margin:0; font-size:20px">HansariaConnect Admin Verification</h1>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 12px; color:#1f2937; font-size:16px">Use the one-time code to sign in:</p>
      <div style="font-size:32px; letter-spacing:8px; font-weight:700; color:#111827; text-align:center; padding:16px 0">${otp}</div>
      <p style="margin:8px 0 0; color:#4b5563">This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
    </div>
    <div style="background:#f9fafb; padding:16px 24px; color:#6b7280; font-size:12px; text-align:center">HansariaConnect</div>
  </div>
</div>`;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const email = String(body?.email || "")
      .toLowerCase()
      .trim();
    if (!email || !ADMINS.has(email)) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }

    await connectDB();
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json(
        { success: false, error: "Not allowed" },
        { status: 403 },
      );
    }

    const otp = generateOtp();

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || "smtp.gmail.com",
      port: Number(process.env.EMAIL_PORT || 465),
      secure: String(process.env.EMAIL_SECURE || "true") === "true",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Admin OTP",
      html: mailTemplate(otp),
    });

    const salt = await randomBytesHex(16);
    const hash = await digestHex("SHA-256", otp + salt);

    const payload = {
      email,
      hash,
      salt,
      exp: Date.now() + 5 * 60 * 1000,
    };

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      "admin_otp_session",
      await signAdminOtpSession(payload),
      authOtpCookieOptions,
    );
    return response;
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
