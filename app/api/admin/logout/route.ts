import { NextRequest, NextResponse } from "next/server"

export async function POST(_req: NextRequest): Promise<NextResponse> {
  const res = NextResponse.json({ success: true })
  res.cookies.delete("admin_session")
  return res
}

