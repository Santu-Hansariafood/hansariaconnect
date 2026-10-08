import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { requireAdmin } from "@/lib/adminAuth";
import AdminTemplate from "@/models/admin/AdminTemplate";
import { Types } from "mongoose";
import { templateActionButtonsSchema } from "@/lib/templateActionButtons";

async function getOwnedTemplate(req: NextRequest, id: string) {
  const auth = await requireAdmin(req);
  if ("error" in auth) return { error: NextResponse.json({ error: auth.error }, { status: auth.status }) };
  await connectDB();
  if (!Types.ObjectId.isValid(id)) {
    return { error: NextResponse.json({ error: "Template not found" }, { status: 404 }) };
  }
  const template = await AdminTemplate.findOne({
    _id: id,
    ...(auth.admin.isSuperAdmin ? {} : { adminId: String(auth.admin._id) }),
  });
  if (!template) return { error: NextResponse.json({ error: "Template not found" }, { status: 404 }) };
  return { template };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await getOwnedTemplate(req, (await params).id);
  if ("error" in result) return result.error;
  const body = await req.json();
  const name = body?.name === undefined ? result.template.name : String(body.name).trim();
  const templateBody = body?.body === undefined ? result.template.body : String(body.body).trim();
  const header = body?.header === undefined ? result.template.header || "" : String(body.header).trim();
  const footer = body?.footer === undefined ? result.template.footer || "" : String(body.footer).trim();
  const defaultLanguage =
    body?.defaultLanguage === undefined
      ? result.template.defaultLanguage || "en"
      : String(body.defaultLanguage).trim().toLowerCase();
  const folder = body?.folder === undefined
    ? result.template.folder || "General"
    : String(body.folder).trim();
  const translations = body?.translations;
  const parsedButtons =
    body?.buttons === undefined
      ? undefined
      : templateActionButtonsSchema.safeParse(body.buttons);
  if (parsedButtons && !parsedButtons.success) {
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
    !folder ||
    folder.length > 80 ||
    !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(defaultLanguage)
  ) {
    return NextResponse.json({ error: "Template is too long" }, { status: 400 });
  }
  if (
    translations !== undefined &&
    (!translations ||
      typeof translations !== "object" ||
      Array.isArray(translations) ||
      Object.entries(translations).some(
        ([locale, translation]) =>
          !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(locale) ||
          typeof translation !== "string" ||
          translation.trim().length > 2000,
      ))
  ) {
    return NextResponse.json({ error: "Invalid translations" }, { status: 400 });
  }
  const normalizedTranslations =
    translations === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(translations).map(([language, text]) => [
            language.toLowerCase(),
            String(text).trim(),
          ]),
        );
  const duplicate = await AdminTemplate.exists({
    _id: { $ne: result.template._id },
    adminId: String(result.template.adminId),
    name,
  });
  if (duplicate) {
    return NextResponse.json(
      { error: "You already have a template with this name" },
      { status: 409 },
    );
  }
  result.template.name = name;
  result.template.body = templateBody;
  result.template.header = header;
  result.template.footer = footer;
  result.template.defaultLanguage = defaultLanguage;
  result.template.folder = folder;
  if (normalizedTranslations !== undefined) {
    result.template.translations = normalizedTranslations;
  }
  if (parsedButtons?.success) {
    result.template.buttons = parsedButtons.data;
  }
  await result.template.save();
  return NextResponse.json({ template: result.template });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const result = await getOwnedTemplate(req, (await params).id);
  if ("error" in result) return result.error;
  await result.template.deleteOne();
  return NextResponse.json({ success: true });
}
