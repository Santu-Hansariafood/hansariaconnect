import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import Admin from "@/models/admin/Admin";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ profile: { userId: auth.admin.userId, email: auth.admin.email, isSuperAdmin: auth.admin.isSuperAdmin } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.keyLogin) return NextResponse.json({ error: "Key sessions cannot edit a profile" }, { status: 403 });
  const body = await req.json();
  const email = body?.email === undefined ? undefined : String(body.email).trim().toLowerCase();
  const password = body?.password === undefined ? undefined : String(body.password);
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password !== undefined && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  await connectDB();
  const admin = await Admin.findById(auth.admin._id);
  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  if (email !== undefined) admin.email = email;
  if (password !== undefined) admin.password = password;
  await admin.save();
  return NextResponse.json({ success: true, profile: { userId: admin.userId, email: admin.email, isSuperAdmin: admin.isSuperAdmin } });
}
