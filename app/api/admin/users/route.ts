import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import AccessControl from "@/models/access/AccessControl";
import { requireAdmin, requireSuperAdmin } from "@/lib/adminAuth";

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
    await connectDB();
    const requestedPage = Number(req.nextUrl.searchParams.get("page") || "1");
    const page = Number.isFinite(requestedPage) && requestedPage > 0
      ? Math.floor(requestedPage)
      : 1;
    const limit = 100;
    const [total, users] = await Promise.all([
      User.countDocuments(),
      User.find(
        {},
        "mobile email sex dateOfBirth termsAccepted lastLoginIp lastLoginAt createdAt",
      )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);
    const userIds = users.map((u: any) => u._id);
    const profiles = await Profile.find({ userId: { $in: userIds } }).lean();
    const access = await AccessControl.find({
      userId: { $in: userIds },
    }).lean();
    const pMap = new Map<string, any>();
    profiles.forEach((p: any) => pMap.set(String(p.userId), p));
    const aMap = new Map<string, any>();
    access.forEach((a: any) => aMap.set(String(a.userId), a));
    const payload = users.map((u: any) => {
      const pid = String(u._id);
      const p = pMap.get(pid);
      const a = aMap.get(pid);
      return {
        id: pid,
        mobile: u.mobile,
        email: u.email || "",
        sex: u.sex || "",
        dateOfBirth: u.dateOfBirth || null,
        termsAccepted: !!u.termsAccepted,
        lastLoginIp: u.lastLoginIp || "",
        lastLoginAt: u.lastLoginAt || null,
        createdAt: u.createdAt || null,
        name: p?.name || "",
        about: p?.about || "",
        avatar: p?.photo || "",
        permissions: a?.permissions || {
          contacts: true,
          groups: false,
          status: false,
          attachments: false,
        },
      };
    });
    return NextResponse.json({
      users: payload,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const input = Array.isArray(body?.users) ? body.users : [body];
    if (!input.length || input.length > 100) {
      return NextResponse.json({ error: "Provide between 1 and 100 user accounts" }, { status: 400 });
    }

    await connectDB();
    const mobiles = input.map((item: any) => String(item?.mobile || "").trim());
    const emails = input.map((item: any) => String(item?.email || "").trim().toLowerCase());
    if (mobiles.some((mobile: string) => !MOBILE_REGEX.test(mobile))) {
      return NextResponse.json({ error: "Every account needs a valid Indian mobile number" }, { status: 400 });
    }
    if (emails.some((email: string) => !EMAIL_REGEX.test(email))) {
      return NextResponse.json({ error: "Every account needs a Gmail, Outlook, or Hansaria Food email" }, { status: 400 });
    }
    if (new Set(mobiles).size !== mobiles.length || new Set(emails).size !== emails.length) {
      return NextResponse.json({ error: "Duplicate mobile or email in request" }, { status: 400 });
    }

    const existing = await User.find({ $or: [{ mobile: { $in: mobiles } }, { email: { $in: emails } }] }).lean();
    if (existing.length) {
      return NextResponse.json({ error: "One or more mobile numbers or emails already exist" }, { status: 409 });
    }

    const created = [];
    for (const item of input) {
      const mobile = String(item.mobile).trim();
      const email = String(item.email).trim().toLowerCase();
      const name = String(item.name || mobile).trim();
      if (!name) {
        return NextResponse.json({ error: "Every account needs a name" }, { status: 400 });
      }
      const user = await User.create({
        createdByAdminId: String(authResult.admin._id),
        name,
        email,
        mobile,
        sex: ["male", "female", "other"].includes(item.sex) ? item.sex : "other",
        dateOfBirth: item.dateOfBirth ? new Date(item.dateOfBirth) : undefined,
        termsAccepted: true,
      });
      await Profile.create({ userId: user._id, name });
      await AccessControl.create({ userId: user._id });
      created.push({ id: String(user._id), name, email, mobile });
    }

    return NextResponse.json({ success: true, users: created }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create users" }, { status: 500 });
  }
}
