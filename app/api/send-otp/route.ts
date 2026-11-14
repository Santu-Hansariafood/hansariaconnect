import { NextRequest, NextResponse } from "next/server";
import { POST as requestLoginOtp } from "../auth/login/route";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  return requestLoginOtp(req);
}
