import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import Admin from "@/models/admin/Admin";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ profile: {
    adminId: String(auth.admin._id),
    userId: auth.admin.userId,
    email: auth.admin.email,
    isSuperAdmin: auth.admin.isSuperAdmin,
    companyName: auth.admin.companyName || "",
    companyDomain: auth.admin.companyDomain || "",
    companyVerificationRequested: auth.admin.companyVerificationRequested,
    isCompanyVerified: auth.admin.isCompanyVerified,
  } });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.session.keyLogin) return NextResponse.json({ error: "Key sessions cannot edit a profile" }, { status: 403 });
  const body = await req.json();
  const email = body?.email === undefined ? undefined : String(body.email).trim().toLowerCase();
  const password = body?.password === undefined ? undefined : String(body.password);
  const companyName =
    body?.companyName === undefined ? undefined : String(body.companyName).trim();
  const rawDomain =
    body?.companyDomain === undefined ? undefined : String(body.companyDomain).trim().toLowerCase();
  let companyDomain: string | undefined;
  if (rawDomain !== undefined) {
    if (!rawDomain) {
      companyDomain = "";
    } else {
      try {
        const parsedDomain = new URL(
          rawDomain.includes("://") ? rawDomain : `https://${rawDomain}`,
        );
        if (
          parsedDomain.protocol !== "https:" ||
          parsedDomain.username ||
          parsedDomain.password ||
          parsedDomain.port ||
          parsedDomain.pathname !== "/" ||
          parsedDomain.search ||
          parsedDomain.hash
        ) throw new Error("invalid domain");
        companyDomain = parsedDomain.hostname;
      } catch {
        return NextResponse.json({ error: "Enter a valid company domain" }, { status: 400 });
      }
    }
  }
  if (companyName !== undefined && companyName.length > 100) {
    return NextResponse.json({ error: "Company name must be 100 characters or fewer" }, { status: 400 });
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  if (password !== undefined && password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  await connectDB();
  const admin = await Admin.findById(auth.admin._id);
  if (!admin) return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  const companyNameChanged =
    companyName !== undefined && companyName !== admin.companyName;
  const companyDomainChanged =
    companyDomain !== undefined && companyDomain !== admin.companyDomain;
  if (email !== undefined) admin.email = email;
  if (password !== undefined) admin.password = password;
  if (companyName !== undefined) admin.companyName = companyName;
  if (companyDomain !== undefined) {
    admin.companyDomain = companyDomain;
  }
  if (companyNameChanged || companyDomainChanged) {
    admin.isCompanyVerified = false;
    admin.companyVerificationRequested = Boolean(
      admin.companyName && admin.companyDomain,
    );
  }
  await admin.save();
  return NextResponse.json({ success: true, profile: {
    adminId: String(admin._id),
    userId: admin.userId,
    email: admin.email,
    isSuperAdmin: admin.isSuperAdmin,
    companyName: admin.companyName || "",
    companyDomain: admin.companyDomain || "",
    companyVerificationRequested: admin.companyVerificationRequested,
    isCompanyVerified: admin.isCompanyVerified,
  } });
}
