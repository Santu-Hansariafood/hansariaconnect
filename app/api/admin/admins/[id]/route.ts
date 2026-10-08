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
    const {
      userId,
      email,
      password,
      isSuperAdmin,
      isCompanyVerified,
      companyName,
      companyDomain,
    } = body;
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
    if (companyName !== undefined) {
      if (typeof companyName !== "string" || companyName.trim().length > 100) {
        return NextResponse.json(
          { success: false, error: "Company name must be 100 characters or fewer" },
          { status: 400 },
        );
      }
      updateData.companyName = companyName.trim();
    }
    if (companyDomain !== undefined) {
      if (typeof companyDomain !== "string") {
        return NextResponse.json(
          { success: false, error: "Enter a valid company domain" },
          { status: 400 },
        );
      }
      if (!companyDomain.trim()) {
        updateData.companyDomain = "";
      } else {
        try {
          const domainUrl = new URL(
            companyDomain.includes("://")
              ? companyDomain
              : `https://${companyDomain}`,
          );
          if (
            domainUrl.protocol !== "https:" ||
            domainUrl.username ||
            domainUrl.password ||
            domainUrl.port ||
            domainUrl.pathname !== "/" ||
            domainUrl.search ||
            domainUrl.hash
          ) throw new Error("invalid domain");
          updateData.companyDomain = domainUrl.hostname;
        } catch {
          return NextResponse.json(
            { success: false, error: "Enter a valid company domain" },
            { status: 400 },
          );
        }
      }
    }
    if (isSuperAdmin !== undefined) updateData.isSuperAdmin = isSuperAdmin;
    if (isCompanyVerified !== undefined) {
      if (typeof isCompanyVerified !== "boolean") {
        return NextResponse.json(
          { success: false, error: "Company verification status must be a boolean" },
          { status: 400 },
        );
      }
      if (isCompanyVerified && !((companyName ?? "") && (companyDomain ?? ""))) {
        const existingAdmin = await Admin.findById(id).select("companyName companyDomain").lean();
        if (!(companyName ?? existingAdmin?.companyName) || !(companyDomain ?? existingAdmin?.companyDomain)) {
          return NextResponse.json(
            { success: false, error: "Set the company name and domain before approving verification" },
            { status: 400 },
          );
        }
      }
      updateData.isCompanyVerified = isCompanyVerified;
      updateData.companyVerificationRequested = false;
    }
    if (password) updateData.password = password;
    if (
      (companyName !== undefined || companyDomain !== undefined) &&
      isCompanyVerified === undefined
    ) {
      updateData.isCompanyVerified = false;
      updateData.companyVerificationRequested = false;
    }

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
