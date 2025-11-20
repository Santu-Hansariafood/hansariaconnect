import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import Contact from "@/models/contact/Contact"
import Profile from "@/models/profile/Profile"
import User from "@/models/user/User"

export async function GET(req: NextRequest) {
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
    const items = await Contact.find({ userId: session.id }).sort({ updatedAt: -1 })
    const allMobiles = items.flatMap((c: any) => Array.isArray(c.mobiles) ? c.mobiles : []).filter(Boolean)
    const registeredUsers = allMobiles.length
      ? await User.find({ mobile: { $in: allMobiles } }, { mobile: 1 })
      : []
    const set = new Set(registeredUsers.map((u: any) => u.mobile))
    const map: Record<string, string> = {}
    for (const u of registeredUsers as any[]) {
      map[u.mobile] = u._id?.toString?.() || ""
    }
    const payload = [] as any[]
    for (const c of items as any[]) {
      const obj = c.toObject()
      const arr = Array.isArray(obj.mobiles) ? obj.mobiles : []
      let regId = ""
      let regProfile: any = null
      for (const m of arr) {
        const id = map[m]
        if (id) {
          regId = id
          break
        }
      }
      if (regId) {
        const p = await Profile.findOne({ userId: regId })
        if (p) regProfile = { name: p.name, photo: p.photo }
      }
      payload.push({
        ...obj,
        registered: arr.some((m: string) => set.has(m)),
        registeredUserId: regId,
        registeredProfile: regProfile,
      })
    }
    return NextResponse.json({ contacts: payload })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

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
    const name = (body?.name || "").toString().trim()
    const mobiles = Array.isArray(body?.mobiles) ? body.mobiles.map((m: any) => String(m)) : []
    const email = (body?.email || "").toString().trim()

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!mobiles.length) {
      return NextResponse.json({ error: "At least one mobile is required" }, { status: 400 })
    }
    const cleanedMobiles = mobiles
      .map((m) => m.replace(/\D/g, ""))
      .filter((m) => /^\d{10}$/.test(m))
    if (!cleanedMobiles.length) {
      return NextResponse.json({ error: "Provide valid 10-digit mobile numbers" }, { status: 400 })
    }

    await connectDB()
    const created = await Contact.create({
      userId: session.id,
      name,
      mobiles: cleanedMobiles,
      email,
    })
    return NextResponse.json({ contact: created }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}