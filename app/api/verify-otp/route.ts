import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";

export async function POST(req: Request) {
  await connectDB();
  const { mobile, code } = await req.json();

  const user = await User.findOne({ mobile });

  if (!user || user.otp !== code) {
    return NextResponse.json({ success: false, message: "Invalid OTP" });
  }

  return NextResponse.json({ success: true, userId: user._id });
}
