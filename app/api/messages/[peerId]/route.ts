import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import Message from "@/models/message/Message"
import Conversation from "@/models/conversation/Conversation"
import User from "@/models/user/User"

export async function GET(req: NextRequest, { params }: { params: { peerId: string } }) {
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
    const { peerId } = params
    const { searchParams } = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(searchParams.get("limit")) || 10))
    const before = searchParams.get("before")
    const last = searchParams.get("last") === "true"
    await connectDB()
    const peerExists = await User.exists({ _id: params.peerId })
    if (!peerExists) {
      return NextResponse.json({ messages: [], hasMore: false })
    }
    let query: any = {
      $or: [
        { from: session.id, to: peerId },
        { from: peerId, to: session.id },
      ],
    }
    let sort: any = { createdAt: 1 }
    if (before) {
      query.createdAt = { $lt: new Date(before) }
      sort = { createdAt: -1 }
    }
    if (last) {
      sort = { createdAt: -1 }
    }
    const docs = await Message.find(query).sort(sort).limit(limit)
    const items = last ? docs.reverse() : before ? docs.reverse() : docs
    const hasMore = await Message.countDocuments({ ...query, createdAt: before ? { $lt: new Date(before) } : undefined })
    return NextResponse.json({ messages: items, hasMore: hasMore > items.length })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { peerId: string } }) {
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
    const type = (body?.type || "text").toString()
    const payload: any = {
      from: session.id,
      to: params.peerId,
      type,
      text: body?.text || "",
      mediaUrl: body?.mediaUrl || "",
      fileName: body?.fileName || "",
      fileSize: body?.fileSize || "",
      duration: body?.duration || undefined,
      linkTitle: body?.linkTitle || "",
      linkDescription: body?.linkDescription || "",
    }
    await connectDB()
    const peerExists = await User.exists({ _id: params.peerId })
    if (!peerExists) {
      return NextResponse.json({ error: "Peer not found" }, { status: 400 })
    }
    const saved = await Message.create(payload)
    try {
      const a = String(session.id)
      const b = String(params.peerId)
      const userA = a < b ? a : b
      const userB = a < b ? b : a
      await Conversation.findOneAndUpdate(
        { userA, userB },
        { userA, userB, lastMessageAt: new Date() },
        { upsert: true }
      )
    } catch {}
    return NextResponse.json({ message: saved }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}