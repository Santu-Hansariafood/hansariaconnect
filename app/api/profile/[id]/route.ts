import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import Profile from "@/models/profile/Profile"
import User from "@/models/user/User"

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
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
    const userId = session.id
    const profile = await Profile.findOne({ userId })
    return NextResponse.json({ profile })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
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
    const { name, about, photo, theme } = body || {}

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updated = await Profile.findOneAndUpdate(
      { userId: session.id },
      {
        userId: session.id,
        name,
        about,
        photo,
        theme,
      },
      { upsert: true, new: true }
    )
    return NextResponse.json({ profile: updated })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
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
    await Profile.findOneAndDelete({ userId: session.id })
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}