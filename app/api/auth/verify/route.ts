import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mobile = (body?.mobile || "").toString()
    const code = (body?.code || "").toString()
    if (!/^\d{10}$/.test(mobile)) {
      return NextResponse.json({ success: false, error: "Invalid mobile" }, { status: 400 })
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ success: false, error: "Invalid code" }, { status: 400 })
    }

    const sessionCookie = req.cookies.get("otp_session")?.value
    if (!sessionCookie) {
      return NextResponse.json({ success: false, error: "No OTP session" }, { status: 400 })
    }

    let payload: any
    try {
      payload = JSON.parse(sessionCookie)
    } catch {
      return NextResponse.json({ success: false, error: "Invalid OTP session" }, { status: 400 })
    }

    if (!payload || !payload.mobile || !payload.hash || !payload.salt || !payload.exp) {
      return NextResponse.json({ success: false, error: "Malformed session" }, { status: 400 })
    }

    if (Date.now() > Number(payload.exp)) {
      const res = NextResponse.json({ success: false, error: "OTP expired" }, { status: 400 })
      res.cookies.delete("otp_session")
      return res
    }

    if (payload.mobile !== mobile) {
      return NextResponse.json({ success: false, error: "Mobile mismatch" }, { status: 400 })
    }

    const hash = crypto.createHash("sha256").update(code + payload.salt).digest("hex")
    if (hash !== payload.hash) {
      return NextResponse.json({ success: false, error: "Incorrect OTP" }, { status: 401 })
    }

    const res = NextResponse.json({ success: true })
    res.cookies.delete("otp_session")
    return res
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 })
  }
}