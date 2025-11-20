import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import User from "@/models/user/User"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
    await connectDB()
    let user: any = null
    try {
      user = await User.findById(params.id)
    } catch {}
    if (!user) {
      return NextResponse.json({ id: params.id, mobile: "" })
    }
    return NextResponse.json({ id: user._id.toString(), mobile: user.mobile })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}