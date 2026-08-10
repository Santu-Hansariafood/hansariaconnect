import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Admin from "@/models/admin/Admin";
import { requireSuperAdmin } from "@/lib/adminAuth";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    await connectDB();
    const body = await req.json();
    const { userId, email, password, isSuperAdmin } = body;
    const resolved =
      context.params instanceof Promise ? await context.params : context.params;
    const id = String(resolved.id || "");

    if (authResult.admin._id.toString() === id && isSuperAdmin !== undefined) {
      return NextResponse.json(
        { success: false, error: "Cannot update your own super admin status" },
        { status: 400 },
      );
    }

    if (userId || email) {
      const existingAdmin = await Admin.findOne({
        $or: [{ userId }, { email }],
        _id: { $ne: id },
      });
      if (existingAdmin) {
        return NextResponse.json(
          { success: false, error: "User ID or email already exists" },
          { status: 400 },
        );
      }
    }

    const updateData: any = {};
    if (userId !== undefined) updateData.userId = userId;
    if (email !== undefined) updateData.email = email;
    if (isSuperAdmin !== undefined) updateData.isSuperAdmin = isSuperAdmin;
    if (password) updateData.password = password;

    const updatedAdmin = await Admin.findByIdAndUpdate(id, updateData, {
      new: true,
      select: "-password",
    });

    if (!updatedAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, admin: updatedAdmin });
  } catch (error: any) {
    console.error("Update admin error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  try {
    const authResult = await requireSuperAdmin(req);
    if ("error" in authResult) {
      return NextResponse.json(
        { success: false, error: authResult.error },
        { status: authResult.status },
      );
    }

    await connectDB();
    const resolved =
      context.params instanceof Promise ? await context.params : context.params;
    const id = String(resolved.id || "");

    if (authResult.admin._id.toString() === id) {
      return NextResponse.json(
        { success: false, error: "Cannot delete your own account" },
        { status: 400 },
      );
    }

    const deletedAdmin = await Admin.findByIdAndDelete(id);

    if (!deletedAdmin) {
      return NextResponse.json(
        { success: false, error: "Admin not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete admin error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
