import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    let session: any
    try {
      session = JSON.parse(sessionCookie)
    } catch {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const mobiles = Array.isArray(body?.mobiles) ? body.mobiles.map((m: any) => String(m)) : []
    const name = (body?.name || "").toString()
    if (!mobiles.length) {
      return NextResponse.json({ error: "No mobiles provided" }, { status: 400 })
    }

    const cleaned = mobiles.map((m) => m.replace(/\D/g, "")).filter((m) => /^\d{10}$/.test(m))
    if (!cleaned.length) {
      return NextResponse.json({ error: "Invalid mobile numbers" }, { status: 400 })
    }

    return NextResponse.json({ success: true, invited: cleaned.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}