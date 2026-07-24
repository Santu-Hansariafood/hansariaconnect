import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import AccessControl from "@/models/access/AccessControl";
import { requireSuperAdmin } from "@/lib/adminAuth";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { error: authResult.error },
        { status: authResult.status },
      );
    }
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
