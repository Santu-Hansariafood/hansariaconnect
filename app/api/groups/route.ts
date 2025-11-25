import { NextRequest, NextResponse } from "next/server"
import { Types } from "mongoose"
import { connectDB } from "@/lib/db/db"
import Group from "@/models/group/Group"
import User from "@/models/user/User"

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val
  if (val == null) return ""
  if (["number", "bigint", "boolean"].includes(typeof val)) return String(val)
  if (typeof val === "object") {
    const obj = val as { toString?: () => string; $oid?: unknown }
    if (typeof obj.$oid === "string") return obj.$oid
    if (typeof obj.toString === "function") {
      const str = obj.toString()
      if (str && str !== "[object Object]") return str
    }
  }
  return ""
}

const sanitizeMobile = (value: unknown) => String(value ?? "").replace(/\D/g, "")

const buildGroupSummary = (group: any) => {
  const members = Array.isArray(group?.members) ? group.members : []
  const adminEntry = members.find((member: any) => member?.role === "admin")

  return {
    id: group?._id?.toString() || "",
    name: group?.name || "",
    avatar: group?.avatar || "",
    members: members.map((member: any) => member?.mobile).filter(Boolean),
    admin: adminEntry?.mobile || "",
    lastMessage: group?.lastMessage || "",
    lastMessageTime: group?.lastMessageAt || group?.updatedAt || group?.createdAt || null,
  }
}

const parseSession = (req: NextRequest) => {
  const sessionCookie = req.cookies.get("user_session")?.value
  if (!sessionCookie) {
    return null
  }
  try {
    const parsed = JSON.parse(sessionCookie)
    if (!parsed?.id) return null
    return parsed as { id: string; mobile?: string }
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = parseSession(req)
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const normalizedId = normalizeId(session.id)
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    await connectDB()

    const memberObjectId = new Types.ObjectId(normalizedId)

    const groups = await Group.find({ "members.userId": memberObjectId })
      .sort({ updatedAt: -1 })
      .lean()

    const payload = groups.map(buildGroupSummary)

    return NextResponse.json({ groups: payload })
  } catch (error: unknown) {
    console.error("GET /api/groups error →", error)
    const message = error instanceof Error ? error.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = parseSession(req)
    if (!session?.id || !session?.mobile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const normalizedId = normalizeId(session.id)
    if (!Types.ObjectId.isValid(normalizedId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }
    const creatorId = new Types.ObjectId(normalizedId)

    const body = await req.json()
    const name = String(body?.name || "").trim()
    const avatar = typeof body?.avatar === "string" ? body.avatar.trim() : ""
    const rawList = Array.isArray(body?.memberMobiles) ? body.memberMobiles : []

    if (!name) {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 })
    }

    const sanitizedMobiles = rawList
      .map((mobile: unknown) => sanitizeMobile(mobile))
      .filter((mobile: string) => /^\d{10}$/.test(mobile))
    const creatorMobile = sanitizeMobile(session.mobile)

    const uniqueMobiles = new Set<string>(sanitizedMobiles)
    if (/^\d{10}$/.test(creatorMobile)) {
      uniqueMobiles.add(creatorMobile)
    }

    const cleanedMobiles = Array.from(uniqueMobiles).filter(Boolean)
    if (!cleanedMobiles.length) {
      return NextResponse.json({ error: "At least one valid member is required" }, { status: 400 })
    }

    await connectDB()

    type LeanUser = { _id: Types.ObjectId; mobile: string }
    const users = (await User.find({ mobile: { $in: cleanedMobiles } }).lean()) as unknown as LeanUser[]
    const userMap = new Map<string, LeanUser>()
    users.forEach((user) => userMap.set(user.mobile, user))

    const missingMobiles = cleanedMobiles.filter((mobile: string) => !userMap.has(mobile))
    if (missingMobiles.length) {
      return NextResponse.json(
        { error: `These numbers are not registered: ${missingMobiles.join(", ")}` },
        { status: 400 }
      )
    }

    const now = new Date()
    const membersPayload = cleanedMobiles.map((mobile: string) => {
      const userDoc = userMap.get(mobile)
      if (!userDoc) {
        throw new Error("Member lookup failed")
      }
      return {
        userId: userDoc._id,
        mobile,
        role: mobile === creatorMobile ? "admin" : "member",
        addedBy: creatorId,
        joinedAt: now,
      }
    })

    const newGroup = await Group.create({
      name,
      avatar,
      createdBy: creatorId,
      members: membersPayload,
    })

    return NextResponse.json({ group: buildGroupSummary(newGroup.toObject()) }, { status: 201 })
  } catch (error: unknown) {
    console.error("POST /api/groups error →", error)
    const message = error instanceof Error ? error.message : "Server error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}


