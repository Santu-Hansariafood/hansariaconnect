import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import AdminTemplate from "@/models/admin/AdminTemplate";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await connectDB();
  const templates = await AdminTemplate.find({ adminId: String(auth.admin._id) }).sort({ updatedAt: -1 }).lean();
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();
  const name = String(body?.name || "").trim();
  const templateBody = String(body?.body || "").trim();
  if (!name || !templateBody) return NextResponse.json({ error: "Template name and body are required" }, { status: 400 });
  if (name.length > 100 || templateBody.length > 2000) return NextResponse.json({ error: "Template is too long" }, { status: 400 });
  await connectDB();
  const template = await AdminTemplate.create({ adminId: String(auth.admin._id), name, body: templateBody });
  return NextResponse.json({ template }, { status: 201 });
}
