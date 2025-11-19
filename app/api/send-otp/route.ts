import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

export async function POST(req: Request) {
  await connectDB();
  const { mobile } = await req.json();

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await User.findOneAndUpdate(
    { mobile },
    { mobile, otp },
    { upsert: true }
  );

  console.log("OTP:", otp);

  return NextResponse.json({ success: true, otpSent: true });
}
