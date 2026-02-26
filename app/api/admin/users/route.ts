import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import User from "@/models/user/User"
import Profile from "@/models/profile/Profile"
import AccessControl from "@/models/access/AccessControl"

const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"])

const parseAdmin = (req: NextRequest) => {
  const raw = req.cookies.get("admin_session")?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.email || !ADMINS.has(String(parsed.email).toLowerCase())) return null
    return parsed as { email: string }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = parseAdmin(req)
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    await connectDB()
    const users = await User.find().sort({ createdAt: -1 }).lean()
    const userIds = users.map((u: any) => u._id)
    const profiles = await Profile.find({ userId: { $in: userIds } }).lean()
    const access = await AccessControl.find({ userId: { $in: userIds } }).lean()
    const pMap = new Map<string, any>()
    profiles.forEach((p: any) => pMap.set(String(p.userId), p))
    const aMap = new Map<string, any>()
    access.forEach((a: any) => aMap.set(String(a.userId), a))
    const payload = users.map((u: any) => {
      const pid = String(u._id)
      const p = pMap.get(pid)
      const a = aMap.get(pid)
      return {
        id: pid,
        mobile: u.mobile,
        name: p?.name || "",
        avatar: p?.photo || "",
        permissions: a?.permissions || { contacts: true, groups: false, status: false, attachments: false },
      }
    })
    return NextResponse.json({ users: payload })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

