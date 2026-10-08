import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import AdminTemplate from "@/models/admin/AdminTemplate";
import Admin from "@/models/admin/Admin";
import { Types } from "mongoose";
import { normalizeTemplateTranslations } from "@/lib/templateTranslations";
import { templateActionButtonsSchema } from "@/lib/templateActionButtons";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  await connectDB();
  const templates = await AdminTemplate.find(
    auth.admin.isSuperAdmin ? {} : { adminId: String(auth.admin._id) },
  )
    .sort({ updatedAt: -1 })
    .lean();
  const owners = await Admin.find(
    { _id: { $in: [...new Set(templates.map((template) => template.adminId))] } },
    "userId",
  ).lean();
  const ownerNames = new Map(owners.map((owner) => [String(owner._id), owner.userId]));
  return NextResponse.json({
    templates: templates.map((template) => ({
      ...template,
      folder: template.folder || "General",
      translations: normalizeTemplateTranslations(template.translations),
      ownerUserId: ownerNames.get(template.adminId) || "Deleted admin",
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await req.json();
  const name = String(body?.name || "").trim();
  const templateBody = String(body?.body || "").trim();
  const header = String(body?.header || "").trim();
  const footer = String(body?.footer || "").trim();
  const defaultLanguage = String(body?.defaultLanguage || "en").trim().toLowerCase();
  const folder = String(body?.folder || "General").trim();
  const translations =
    body?.translations && typeof body.translations === "object" &&
    !Array.isArray(body.translations)
      ? body.translations as Record<string, unknown>
      : {};
  const parsedButtons = templateActionButtonsSchema.safeParse(body?.buttons ?? []);
  if (!parsedButtons.success) {
    return NextResponse.json(
      { error: parsedButtons.error.issues[0]?.message || "Invalid action buttons" },
      { status: 400 },
    );
  }
  if (!name || !templateBody) return NextResponse.json({ error: "Template name and body are required" }, { status: 400 });
  if (
    name.length > 100 ||
    templateBody.length > 2000 ||
    header.length > 2000 ||
    footer.length > 2000 ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(defaultLanguage) ||
    !folder ||
    folder.length > 80
  ) return NextResponse.json({ error: "Template name, folder, or body is too long or empty" }, { status: 400 });
  if (Object.entries(translations).some(
    ([locale, translation]) =>
      !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale) ||
      typeof translation !== "string" ||
      translation.trim().length > 2000,
  )) {
    return NextResponse.json(
      { error: "Translations need valid language codes and message text no longer than 2,000 characters" },
      { status: 400 },
    );
  }
  const normalizedTranslations = Object.fromEntries(
    Object.entries(translations).map(([language, text]) => [
      language.toLowerCase(),
      String(text).trim(),
    ]),
  );
  await connectDB();
  const requestedAdminId =
    typeof body?.adminId === "string" ? body.adminId.trim() : "";
  const adminId = auth.admin.isSuperAdmin && requestedAdminId
    ? requestedAdminId
    : String(auth.admin._id);
  if (auth.admin.isSuperAdmin && requestedAdminId) {
    if (!Types.ObjectId.isValid(adminId)) {
      return NextResponse.json({ error: "Admin workspace not found" }, { status: 404 });
    }
    const owner = await Admin.exists({ _id: adminId });
    if (!owner) {
      return NextResponse.json({ error: "Admin workspace not found" }, { status: 404 });
    }
  }
  const existingTemplate = await AdminTemplate.exists({ adminId, name });
  if (existingTemplate) {
    return NextResponse.json(
      { error: "You already have a template with this name" },
      { status: 409 },
    );
  }
  const template = await AdminTemplate.create({
    adminId,
    name,
    body: templateBody,
    header,
    footer,
    defaultLanguage,
    folder,
    translations: normalizedTranslations,
    buttons: parsedButtons.data,
  });
  return NextResponse.json({ template }, { status: 201 });
}
