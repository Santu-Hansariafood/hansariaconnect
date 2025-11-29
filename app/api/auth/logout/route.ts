import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const response = NextResponse.json({ success: true })

    response.cookies.delete("user_session")
    response.cookies.delete("otp_session")

    return response
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

