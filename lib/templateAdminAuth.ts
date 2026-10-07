import Admin from "@/models/admin/Admin";

export const verifyTemplateAdminCredentials = async (
  adminId: string,
  identifier: string,
  password: string,
): Promise<boolean> => {
  if (!adminId || !identifier.trim() || !password) return false;

  const admin = await Admin.findById(adminId);
  if (!admin) return false;

  const normalizedIdentifier = identifier.trim().toLowerCase();
  const identifierMatches =
    admin.userId.toLowerCase() === normalizedIdentifier ||
    admin.email.toLowerCase() === normalizedIdentifier;

  if (!identifierMatches) return false;
  return admin.comparePassword(password);
};
