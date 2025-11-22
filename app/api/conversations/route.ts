import { NextRequest, NextResponse } from "next/server"
import { connectDB } from "@/lib/db/db"
import Conversation from "@/models/conversation/Conversation"
import User from "@/models/user/User"
import Profile from "@/models/profile/Profile"
import Message from "@/models/message/Message"
import { Types } from "mongoose"

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val
  if (val == null) return String(val)
  if (typeof val === "number" || typeof val === "bigint" || typeof val === "boolean") return String(val)

  if (typeof val === "object") {
    const obj = val as { toString?: () => string; $oid?: unknown }
    if (typeof obj.$oid === "string") return obj.$oid
    if (typeof obj.toString === "function") {
      const s = obj.toString()
      if (s && s !== "[object Object]") return s
    }
  }

  return String(val)
}

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

    const rawUserId = normalizeId(session.id)
    if (!Types.ObjectId.isValid(rawUserId)) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 })
    }
    const userId = new Types.ObjectId(rawUserId)

    await connectDB()

    // Find all conversations where the user is either userA or userB
    const conversations = await Conversation.find({
      $or: [{ userA: userId }, { userB: userId }],
    })
      .sort({ lastMessageAt: -1 })
      .lean()

    const conversationsList = []

    for (const conv of conversations) {
      // Determine the peer user (the other user in the conversation)
      const peerId = String(conv.userA) === String(userId)
        ? conv.userB 
        : conv.userA

      // Get peer user info
      const peerUser = await User.findById(peerId).lean()
      if (!peerUser) continue

      // Get peer profile for name and photo
      const peerProfile = await Profile.findOne({ userId: peerId }).lean()

      // Get the last message in this conversation
      const lastMessage = await Message.findOne({
        $or: [
          { from: userId, to: peerId },
          { from: peerId, to: userId },
        ],
      })
        .sort({ createdAt: -1 })
        .lean()

      conversationsList.push({
        id: String(peerId),
        peerId: String(peerId),
        mobile: peerUser.mobile || "",
        name: peerProfile?.name || peerUser.mobile || "Unknown",
        avatar: peerProfile?.photo || "",
        lastMessageAt: conv.lastMessageAt || conv.createdAt || new Date(),
        lastMessage: lastMessage
          ? {
              id: String(lastMessage._id),
              type: lastMessage.type,
              text: lastMessage.text || "",
              from: String(lastMessage.from),
              to: String(lastMessage.to),
              timestamp: lastMessage.createdAt,
              status: lastMessage.status || "sent",
            }
          : null,
      })
    }

    return NextResponse.json({ conversations: conversationsList })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}

