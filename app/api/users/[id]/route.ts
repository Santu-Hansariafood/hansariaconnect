import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import User from "@/models/user/User"
import Profile from "@/models/profile/Profile"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const resolvedParams = params instanceof Promise ? await params : params;
    
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
      user = await User.findById(resolvedParams.id)
    } catch {}
    if (!user) {
      return NextResponse.json({ id: resolvedParams.id, mobile: "", name: "", avatar: "" })
    }
    
    const profile = await Profile.findOne({ userId: resolvedParams.id }).lean()
    const profileData = Array.isArray(profile) ? profile[0] : profile
    
    return NextResponse.json({ 
      id: user._id.toString(), 
      mobile: user.mobile || "",
      name: (profileData as any)?.name || "",
      avatar: (profileData as any)?.photo || ""
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}