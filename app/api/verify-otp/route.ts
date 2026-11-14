import { NextRequest, NextResponse } from "next/server";
import { POST as verifyOtp } from "../auth/verify/route";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return verifyOtp(req);
}
