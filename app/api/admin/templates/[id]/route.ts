import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import AdminTemplate from "@/models/admin/AdminTemplate";

async function getOwnedTemplate(req: NextRequest, id: string) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  await connectDB();
  const template = await AdminTemplate.findOne({ _id: id, adminId: String(auth.admin._id) });
  if (!template) return { error: NextResponse.json({ error: "Template not found" }, { status: 404 }) };
  return { template };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await getOwnedTemplate(req, (await params).id);
  if ("error" in result) return result.error;
  const body = await req.json();
  const name = body?.name === undefined ? result.template.name : String(body.name).trim();
  const templateBody = body?.body === undefined ? result.template.body : String(body.body).trim();
  if (!name || !templateBody) return NextResponse.json({ error: "Template name and body are required" }, { status: 400 });
  result.template.name = name;
  result.template.body = templateBody;
  await result.template.save();
  return NextResponse.json({ template: result.template });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await getOwnedTemplate(req, (await params).id);
  if ("error" in result) return result.error;
  await result.template.deleteOne();
  return NextResponse.json({ success: true });
}
