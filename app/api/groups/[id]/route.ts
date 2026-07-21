import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Group from "@/models/group/Group";
import Profile from "@/models/profile/Profile";

type GroupMember = {
  userId: any;
  mobile: string;
  role: string;
};

type GroupDoc = {
  _id: any;
  name: string;
  avatar?: string;
  members: GroupMember[];
  lastMessage?: string;
  lastMessageAt?: any;
  updatedAt?: any;
  createdAt?: any;
};

const normalizeId = (val: unknown): string => {
  if (typeof val === "string") return val;
  if (val == null) return "";
  if (["number", "bigint", "boolean"].includes(typeof val)) return String(val);
  if (typeof val === "object") {
    const obj = val as { toString?: () => string; $oid?: unknown };
    if (typeof obj.$oid === "string") return obj.$oid;
    if (typeof obj.toString === "function") {
      const str = obj.toString();
      if (str && str !== "[object Object]") return str;
    }
  }
  return "";
};

const parseSession = (req: NextRequest) => {
  const raw = req.cookies.get("user_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.id) return null;
    return parsed as { id: string; mobile?: string };
  } catch {
    return null;
  }
};

const resolveParams = async (
  params: { id: string } | Promise<{ id: string }>,
) => {
  return params instanceof Promise ? await params : params;
};

const buildDetailedGroup = async (group: GroupDoc) => {
  const members = Array.isArray(group?.members) ? group.members : [];
  const memberIds = members
    .map((member: any) => member?.userId)
    .filter(Boolean);

  const profiles = memberIds.length
    ? await Profile.find({ userId: { $in: memberIds } }).lean()
    : [];

  const profileMap = new Map<string, any>();
  profiles.forEach((profile: any) =>
    profileMap.set(String(profile.userId), profile),
  );

  const memberPayload = members.map((member: any) => {
    const profile = profileMap.get(String(member.userId));
    return {
      id: String(member.userId),
      name: profile?.name || member.mobile,
      avatar: profile?.photo || "",
      mobile: member.mobile,
      role: member.role || "member",
    };
  });

  const adminEntry = members.find((member: any) => member?.role === "admin");

  return {
    id: group?._id?.toString() || "",
    name: group?.name || "",
    avatar: group?.avatar || "",
    members: memberPayload,
    adminMobile: adminEntry?.mobile || "",
    lastMessage: group?.lastMessage || "",
    lastMessageTime:
      group?.lastMessageAt || group?.updatedAt || group?.createdAt || null,
  };
};

export async function GET(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = parseSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await resolveParams(context.params);
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const normalizedSessionId = normalizeId(session.id);
    if (!Types.ObjectId.isValid(normalizedSessionId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const sessionObjectId = new Types.ObjectId(normalizedSessionId);

    await connectDB();

    // ---- TYPE FIX HERE ----
    const group = (await Group.findById(id).lean()) as GroupDoc | null;

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const membership = group.members.find(
      (member: any) => String(member.userId) === String(sessionObjectId),
    );

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const payload = await buildDetailedGroup(group);
    return NextResponse.json({
      group: { ...payload, isAdmin: membership.role === "admin" },
    });
  } catch (error: any) {
    console.error("GET /api/groups/[id] error →", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = parseSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await resolveParams(context.params);
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid group id" }, { status: 400 });
    }

    const normalizedSessionId = normalizeId(session.id);
    if (!Types.ObjectId.isValid(normalizedSessionId)) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    const sessionObjectId = new Types.ObjectId(normalizedSessionId);

    const body = await req.json();
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const avatar = typeof body?.avatar === "string" ? body.avatar.trim() : null;

    const updates: Record<string, any> = {};
    if (name) updates.name = name;
    if (avatar !== null) updates.avatar = avatar;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    await connectDB();

    const group = (await Group.findOneAndUpdate(
      {
        _id: id,
        members: { $elemMatch: { userId: sessionObjectId, role: "admin" } },
      },
      { $set: updates },
      { new: true },
    ).lean()) as GroupDoc | null;

    if (!group) {
      return NextResponse.json(
        { error: "Group not found or no permission" },
        { status: 404 },
      );
    }

    const payload = await buildDetailedGroup(group);
    return NextResponse.json({ group: { ...payload, isAdmin: true } });
  } catch (error: any) {
    console.error("PATCH /api/groups/[id] error →", error);
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 },
    );
  }
}
