import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db/db";
import { getUserSession } from "@/lib/sessionAuth";
import { apiError, parseJson } from "@/lib/api/request";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import Contact from "@/models/contact/Contact";
import Profile from "@/models/profile/Profile";
import Admin from "@/models/admin/Admin";
import User from "@/models/user/User";
import {
  EMAIL_REGEX,
  isValidPersonName,
  normalizeEmailInput,
  normalizeNameInput,
} from "@/utils/validation/formInputs";

interface ContactPayload {
  name: string;
  mobiles: string[];
  email?: string;
}

const createContactSchema = z.object({
  name: z.string().max(100),
  mobiles: z.array(z.string().max(100)).min(1).max(10),
  email: z.string().max(254).optional(),
});

const getSession = async (req: NextRequest) => {
  const session = await getUserSession(req);
  if (!session?.id) return null;
  return session;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const contacts = await Contact.find({ userId: session.id })
      .sort({ updatedAt: -1 })
      .select({
        name: 1,
        mobiles: 1,
        email: 1,
        avatar: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .lean();

    const extractedMobiles = contacts
      .flatMap((item: any) => (Array.isArray(item.mobiles) ? item.mobiles : []))
      .filter(Boolean);

    const registeredUsers = extractedMobiles.length
      ? await User.find(
          { mobile: { $in: extractedMobiles } },
          { mobile: 1, createdByAdminId: 1 },
        ).lean()
      : [];

    const registeredNumbers = new Set(
      registeredUsers.map((u: any) => u.mobile),
    );

    const mobileToId: Record<string, string> = {};
    registeredUsers.forEach((u: any) => {
      mobileToId[u.mobile] = u._id.toString();
    });

    const candidateUserIds: string[] = [];
    const perContactUserId: Record<string, string> = {};

    for (const c of contacts) {
      const mobiles = Array.isArray((c as any).mobiles)
        ? (c as any).mobiles
        : [];
      let uid = "";
      for (const m of mobiles) {
        const found = mobileToId[m];
        if (found) {
          uid = found;
          break;
        }
      }
      if (uid) {
        perContactUserId[String((c as any)._id)] = uid;
        candidateUserIds.push(uid);
      }
    }

    const uniqueUserIds = Array.from(new Set(candidateUserIds));
    const adminIds = [
      ...new Set(
        registeredUsers
          .map((user: any) => String(user.createdByAdminId || ""))
          .filter(Boolean),
      ),
    ];
    const businessAdmins = adminIds.length
      ? await Admin.find({ _id: { $in: adminIds } })
          .select("companyName companyDomain isCompanyVerified")
          .lean()
      : [];
    const adminMap = new Map(
      businessAdmins.map((admin) => [String(admin._id), admin]),
    );
    const registeredUserMap = new Map(
      registeredUsers.map((user: any) => [String(user._id), user]),
    );
    const profiles = uniqueUserIds.length
      ? await Profile.find(
          { userId: { $in: uniqueUserIds } },
          { userId: 1, name: 1, photo: 1 },
        ).lean()
      : [];
    const profileMap = new Map<string, any>();
    profiles.forEach((p: any) => profileMap.set(String(p.userId), p));

    const payload = contacts.map((contactObj: any) => {
      const mobiles = Array.isArray(contactObj.mobiles)
        ? contactObj.mobiles
        : [];
      const cid = String(contactObj._id);
      const registeredUserId = perContactUserId[cid] || "";
      const prof = registeredUserId ? profileMap.get(registeredUserId) : null;
      const registeredUser = registeredUserMap.get(registeredUserId);
      const ownerAdmin = registeredUser?.createdByAdminId
        ? adminMap.get(String(registeredUser.createdByAdminId))
        : null;
      const isCompanyVerified = Boolean(
        ownerAdmin?.isCompanyVerified && ownerAdmin.companyName,
      );
      const registeredProfile = prof
        ? {
            name: isCompanyVerified ? ownerAdmin?.companyName : prof.name,
            photo: prof.photo,
            companyName: ownerAdmin?.companyName || "",
            companyDomain: ownerAdmin?.companyDomain || "",
            isCompanyVerified,
          }
        : null;
      return {
        ...contactObj,
        registered: mobiles.some((m: string) => registeredNumbers.has(m)),
        registeredUserId,
        registeredProfile,
      };
    });

    return NextResponse.json({ contacts: payload }, { status: 200 });
  } catch (error: any) {
    console.error("GET /contacts error →", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsedBody = await parseJson(req, createContactSchema);
    if (!parsedBody.success) return parsedBody.response;
    const body: ContactPayload = parsedBody.data;

    const name = normalizeNameInput(String(body?.name || "")).trim();
    const rawMobiles = Array.isArray(body?.mobiles)
      ? body.mobiles.map((mobile) => mobile.trim()).filter(Boolean)
      : [];
    const normalizedMobiles = rawMobiles.map(normalizeIndianMobile);
    if (normalizedMobiles.some((mobile) => mobile === null)) {
      return NextResponse.json(
        {
          error:
            "Each mobile number must be a valid 10-digit Indian number, with or without the +91 country code.",
        },
        { status: 400 },
      );
    }
    const mobiles = Array.from(new Set(normalizedMobiles));
    const email = normalizeEmailInput(String(body?.email || ""));

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!isValidPersonName(name)) {
      return NextResponse.json(
        {
          error:
            "Name must start with a capital letter and contain only letters, spaces, apostrophes, or hyphens",
        },
        { status: 400 },
      );
    }

    if (!mobiles.length) {
      return NextResponse.json(
        { error: "Enter at least one valid Indian mobile number." },
        { status: 400 },
      );
    }

    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address" },
        { status: 400 },
      );
    }

    await connectDB();

    const existingContact = await Contact.findOne({
      userId: session.id,
      mobiles: { $in: mobiles },
    }).select("name mobiles");
    if (existingContact) {
      return NextResponse.json(
        {
          error: `This number is already saved with ${existingContact.name}.`,
        },
        { status: 409 },
      );
    }

    const newContact = await Contact.create({
      userId: session.id,
      name,
      mobiles,
      email,
    });

    return NextResponse.json({ contact: newContact }, { status: 201 });
  } catch (error: unknown) {
    return apiError(error, "POST /contacts");
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    const name =
      typeof body?.name === "string"
        ? normalizeNameInput(body.name).trim()
        : "";

    if (!id) {
      return NextResponse.json(
        { error: "Contact id required" },
        { status: 400 },
      );
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (!isValidPersonName(name)) {
      return NextResponse.json(
        {
          error:
            "Name must start with a capital letter and contain only letters, spaces, apostrophes, or hyphens",
        },
        { status: 400 },
      );
    }

    await connectDB();

    const contact = await Contact.findOneAndUpdate(
      { _id: id, userId: session.id },
      { $set: { name } },
      { new: true },
    );

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /contacts error →", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json(
        { error: "Contact id required" },
        { status: 400 },
      );
    }

    await connectDB();

    const deleted = await Contact.findOneAndDelete({
      _id: id,
      userId: session.id,
    });
    if (!deleted) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error: any) {
    console.error("DELETE /contacts error →", error);
    return NextResponse.json(
      { error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
