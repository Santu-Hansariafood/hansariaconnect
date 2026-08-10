import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/db";
import Group, { IGroup, IGroupMember } from "@/models/group/Group";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import { getUserSession } from "@/lib/sessionAuth";

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

const resolveParams = async (
  params: { id: string } | Promise<{ id: string }>,
) => {
  return params instanceof Promise ? await params : params;
};

type LeanProfile = {
  userId: Types.ObjectId | string;
  name?: string;
  photo?: string;
};
type GroupLike = Partial<IGroup> & { _id?: Types.ObjectId | string };

const sanitizeMobile = (value: unknown) =>
  String(value ?? "").replace(/\D/g, "");
const isValidMobile = (mobile: string | undefined | null): mobile is string =>
  typeof mobile === "string" && mobile.length > 0;

const buildDetailedGroup = async (group: GroupLike, isAdmin: boolean) => {
  const members = Array.isArray(group?.members)
    ? (group.members as IGroupMember[])
    : [];
  const memberIds = members
    .map((member) => member.userId)
    .filter((identifier): identifier is Types.ObjectId => Boolean(identifier));

  const profiles = memberIds.length
    ? await Profile.find({ userId: { $in: memberIds } }).lean<LeanProfile[]>()
    : [];

  const profileMap = new Map<string, LeanProfile>();
  profiles.forEach((profile) =>
    profileMap.set(String(profile.userId), profile),
  );

  const memberPayload = members.map((member) => {
    const profile = profileMap.get(String(member.userId));
    return {
      id: String(member.userId),
      name: profile?.name || member.mobile,
      avatar: profile?.photo || "",
      mobile: member.mobile,
      role: member.role || "member",
    };
  });

  const adminEntry = members.find((member) => member.role === "admin");

  return {
    group: {
      id: group?._id?.toString() || "",
      name: group?.name || "",
      avatar: group?.avatar || "",
      members: memberPayload,
      adminMobile: adminEntry?.mobile || "",
      lastMessage: group?.lastMessage || "",
      lastMessageTime:
        group?.lastMessageAt || group?.updatedAt || group?.createdAt || null,
      isAdmin,
    },
  };
};

const ensureAdminGroup = async (groupId: string, adminId: Types.ObjectId) => {
  const group = await Group.findById(groupId);
  if (!group) return null;

  const membership = group.members.find(
    (member: IGroupMember) => String(member.userId) === String(adminId),
  );

  if (!membership || membership.role !== "admin") {
    return null;
  }

  return { group, membership };
};

export async function POST(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
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

    const adminObjectId = new Types.ObjectId(normalizedSessionId);

    const body = await req.json();
    const rawList = Array.isArray(body?.mobiles) ? body.mobiles : [];
    const sanitizedMobiles = rawList
      .map((mobile: unknown) => sanitizeMobile(mobile))
      .filter((mobile: string) => /^\d{10}$/.test(mobile));

    if (!sanitizedMobiles.length) {
      return NextResponse.json(
        { error: "Provide at least one valid mobile" },
        { status: 400 },
      );
    }

    await connectDB();

    const adminGroup = await ensureAdminGroup(id, adminObjectId);
    if (!adminGroup) {
      return NextResponse.json(
        { error: "Group not found or no permission" },
        { status: 403 },
      );
    }

    const { group } = adminGroup;
    const membersList = group.members as IGroupMember[];
    const existingMobiles = new Set(
      membersList.map((member) => member.mobile).filter(isValidMobile),
    );

    const mobilesToAdd = sanitizedMobiles.filter(
      (mobile: string) => !existingMobiles.has(mobile),
    );
    if (!mobilesToAdd.length) {
      return NextResponse.json(
        { error: "All numbers are already members" },
        { status: 400 },
      );
    }

    type LeanUser = { _id: Types.ObjectId; mobile: string };
    const users = await User.find({ mobile: { $in: mobilesToAdd } }).lean<
      LeanUser[]
    >();
    const userMap = new Map<string, LeanUser>();
    users.forEach((user) => userMap.set(user.mobile, user));

    const missing = mobilesToAdd.filter(
      (mobile: string) => !userMap.has(mobile),
    );
    if (missing.length) {
      return NextResponse.json(
        { error: `These numbers are not registered: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    const now = new Date();
    mobilesToAdd.forEach((mobile: string) => {
      const userDoc = userMap.get(mobile);
      if (!userDoc) return;
      membersList.push({
        userId: userDoc._id,
        mobile,
        role: "member",
        addedBy: adminObjectId,
        joinedAt: now,
      });
    });

    await group.save();

    return NextResponse.json(
      await buildDetailedGroup(group.toObject() as GroupLike, true),
    );
  } catch (error: unknown) {
    console.error("POST /api/groups/[id]/members error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
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

    const adminObjectId = new Types.ObjectId(normalizedSessionId);

    const body = await req.json();
    const memberId = String(body?.memberId || "");
    if (!Types.ObjectId.isValid(memberId)) {
      return NextResponse.json({ error: "Invalid member id" }, { status: 400 });
    }

    await connectDB();

    const adminGroup = await ensureAdminGroup(id, adminObjectId);
    if (!adminGroup) {
      return NextResponse.json(
        { error: "Group not found or no permission" },
        { status: 403 },
      );
    }

    const { group } = adminGroup;
    const membersList = group.members as IGroupMember[];
    const memberIndex = membersList.findIndex(
      (member) => String(member.userId) === memberId,
    );

    if (memberIndex === -1) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetMember = membersList[memberIndex];
    const adminCount = membersList.filter(
      (member) => member.role === "admin",
    ).length;

    if (String(targetMember.userId) === String(adminObjectId)) {
      return NextResponse.json(
        { error: "Transfer admin rights before leaving the group" },
        { status: 400 },
      );
    }

    if (targetMember.role === "admin" && adminCount <= 1) {
      return NextResponse.json(
        { error: "At least one admin is required" },
        { status: 400 },
      );
    }

    group.members.splice(memberIndex, 1);
    await group.save();

    return NextResponse.json(
      await buildDetailedGroup(group.toObject() as GroupLike, true),
    );
  } catch (error: unknown) {
    console.error("DELETE /api/groups/[id]/members error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const session = await getUserSession(req);
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

    const adminObjectId = new Types.ObjectId(normalizedSessionId);

    const body = await req.json();
    const memberId = String(body?.memberId || "");
    const role =
      body?.role === "admin" || body?.role === "member" ? body.role : null;

    if (!Types.ObjectId.isValid(memberId) || !role) {
      return NextResponse.json(
        { error: "Provide valid member id and role" },
        { status: 400 },
      );
    }

    await connectDB();

    const adminGroup = await ensureAdminGroup(id, adminObjectId);
    if (!adminGroup) {
      return NextResponse.json(
        { error: "Group not found or no permission" },
        { status: 403 },
      );
    }

    const { group } = adminGroup;
    const membersList = group.members as IGroupMember[];
    const targetMember = membersList.find(
      (member) => String(member.userId) === memberId,
    );

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (targetMember.role === role) {
      return NextResponse.json(
        { error: "No changes required" },
        { status: 400 },
      );
    }

    if (targetMember.role === "admin" && role === "member") {
      const adminCount = membersList.filter(
        (member) => member.role === "admin",
      ).length;
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: "At least one admin is required" },
          { status: 400 },
        );
      }
    }

    targetMember.role = role;
    await group.save();

    return NextResponse.json(
      await buildDetailedGroup(group.toObject() as GroupLike, true),
    );
  } catch (error: unknown) {
    console.error("PATCH /api/groups/[id]/members error →", error);
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
