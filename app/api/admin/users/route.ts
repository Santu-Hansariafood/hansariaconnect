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
    const users = await User.find().sort({ createdAt: -1 }).lean();
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
        name: p?.name || "",
        avatar: p?.photo || "",
        permissions: a?.permissions || {
          contacts: true,
          groups: false,
          status: false,
          attachments: false,
        },
      };
    });
    return NextResponse.json({ users: payload });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
