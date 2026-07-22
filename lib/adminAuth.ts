import { NextRequest } from "next/server";
import cookie from "cookie";
import Admin from "@/models/admin/Admin";
import { connectDB } from "./db/db";

export interface AdminSession {
  adminId: string;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
}

export async function getAdminSession(req: NextRequest): Promise<AdminSession | null> {
  try {
    const cookies = cookie.parse(req.headers.get("cookie") || "");
    if (!cookies.admin_session) return null;
    const session: AdminSession = JSON.parse(cookies.admin_session);
    return session;
  } catch {
    return null;
  }
}

export async function requireAdmin(req: NextRequest) {
  const session = await getAdminSession(req);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }
  await connectDB();
  const admin = await Admin.findById(session.adminId);
  if (!admin) {
    return { error: "Unauthorized", status: 401 };
  }
  return { admin, session };
}

export async function requireSuperAdmin(req: NextRequest) {
  const adminResult = await requireAdmin(req);
  if ("error" in adminResult) {
    return adminResult;
  }
  if (!adminResult.admin.isSuperAdmin) {
    return { error: "Forbidden: Super admin access required", status: 403 };
  }
  return adminResult;
}
