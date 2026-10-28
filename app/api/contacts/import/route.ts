import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectDB } from "@/lib/db/db";
import { getUserSession } from "@/lib/sessionAuth";
import { apiError, parseJson } from "@/lib/api/request";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import Contact from "@/models/contact/Contact";
import { isValidPersonName, normalizeNameInput } from "@/utils/validation/formInputs";

const importSchema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().max(120),
        mobiles: z.array(z.string().max(100)).max(10),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getUserSession(req);
    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await parseJson(req, importSchema);
    if (!body.success) return body.response;

    await connectDB();

    const normalizedContacts = body.data.contacts.map((contact) => {
      const name = normalizeNameInput(contact.name).trim();
      const mobiles = Array.from(
        new Set(
          contact.mobiles
            .map((mobile) => normalizeIndianMobile(mobile))
            .filter((mobile): mobile is string => mobile !== null),
        ),
      );

      return {
        name: isValidPersonName(name) ? name : "Mobile Contact",
        mobiles,
      };
    });

    const allMobiles = Array.from(
      new Set(normalizedContacts.flatMap((contact) => contact.mobiles)),
    );
    const existingContacts = allMobiles.length
      ? await Contact.find(
          { userId: session.id, mobiles: { $in: allMobiles } },
          { mobiles: 1 },
        ).lean()
      : [];
    const existingMobiles = new Set(
      existingContacts.flatMap((contact) => contact.mobiles),
    );
    const seenMobiles = new Set<string>();
    const toInsert: Array<{ userId: string; name: string; mobiles: string[] }> =
      [];
    let skippedExistingCount = 0;
    let skippedInvalidCount = 0;

    for (const contact of normalizedContacts) {
      if (contact.mobiles.length === 0) {
        skippedInvalidCount += 1;
        continue;
      }

      if (
        contact.mobiles.some(
          (mobile) => existingMobiles.has(mobile) || seenMobiles.has(mobile),
        )
      ) {
        skippedExistingCount += 1;
        continue;
      }

      contact.mobiles.forEach((mobile) => seenMobiles.add(mobile));
      toInsert.push({ userId: session.id, ...contact });
    }

    const inserted = toInsert.length
      ? await Contact.insertMany(toInsert, { ordered: true })
      : [];

    return NextResponse.json({
      success: true,
      importedCount: inserted.length,
      skippedExistingCount,
      skippedInvalidCount,
    });
  } catch (error) {
    return apiError(error, "POST /api/contacts/import");
  }
}
