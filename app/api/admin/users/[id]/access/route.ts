import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import AccessControl from "@/models/access/AccessControl";

const ADMINS = new Set(["santude1997@gmail.com", "test@gmail.com"]);

const parseAdmin = (req: NextRequest) => {
  const raw = req.cookies.get("admin_session")?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.email || !ADMINS.has(String(parsed.email).toLowerCase()))
      return null;
    return parsed as { email: string };
  } catch {
    return null;
  }
};

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const admin = parseAdmin(req);
    if (!admin)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const resolved =
      context.params instanceof Promise ? await context.params : context.params;
    const id = String(resolved.id || "");
    if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    const body = await req.json();
    const nextPermissions: any = {
      contacts: !!body?.permissions?.contacts,
      groups: !!body?.permissions?.groups,
      status: !!body?.permissions?.status,
      attachments: !!body?.permissions?.attachments,
    };
    await connectDB();
    const updated = await AccessControl.findOneAndUpdate(
      { userId: id },
      { userId: id, permissions: nextPermissions },
      { new: true, upsert: true },
    ).lean();
    return NextResponse.json({
      ok: true,
      permissions: (updated as any)?.permissions || nextPermissions,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
