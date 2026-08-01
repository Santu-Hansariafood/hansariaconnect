import { NextRequest } from "next/server";
import Admin from "@/models/admin/Admin";
import { connectDB } from "./db/db";
import { getAdminSession } from "@/lib/sessionAuth";

export interface AdminSession {
  adminId: string;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  keyLogin?: boolean;
}

export async function getAdminSessionFromRequest(
  req: NextRequest,
): Promise<AdminSession | null> {
  const session = await getAdminSession(req);
  if (!session) return null;

  if (
    typeof session.adminId !== "string" ||
    typeof session.userId !== "string" ||
    typeof session.email !== "string" ||
    typeof session.isSuperAdmin !== "boolean"
  ) {
    return null;
  }

  return {
    adminId: session.adminId,
    userId: session.userId,
    email: session.email,
    isSuperAdmin: session.isSuperAdmin,
  };
}

export async function requireAdmin(req: NextRequest) {
  const session = await getAdminSessionFromRequest(req);
  if (!session) {
    return { error: "Unauthorized", status: 401 };
  }

  if (session.keyLogin) {
    const admin = {
      _id: session.adminId,
      userId: session.userId,
      email: session.email,
      isSuperAdmin: session.isSuperAdmin,
    };
    return { admin, session };
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
