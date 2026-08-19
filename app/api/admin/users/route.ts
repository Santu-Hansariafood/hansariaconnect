import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Profile from "@/models/profile/Profile";
import AccessControl from "@/models/access/AccessControl";
import { requireSuperAdmin } from "@/lib/adminAuth";

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
