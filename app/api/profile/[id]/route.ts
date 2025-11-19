import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import Profile from "@/models/profile/Profile"
import User from "@/models/user/User"

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
    const profile = await Profile.findOne({ userId: id })
    return NextResponse.json({ profile })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
    const body = await req.json()
    const { name, about, photo, theme } = body || {}

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }

    const updated = await Profile.findOneAndUpdate(
      { userId: id },
      {
        userId: id,
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

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    await connectDB()
    const { id } = params
    await Profile.findOneAndDelete({ userId: id })
    return NextResponse.json({ deleted: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}