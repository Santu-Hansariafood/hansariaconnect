import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import Contact from "@/models/contact/Contact";
import Profile from "@/models/profile/Profile";
import User from "@/models/user/User";

interface SessionCookie {
  id: string;
  mobile: string;
}

interface ContactPayload {
  name: string;
  mobiles: string[];
  email?: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: SessionCookie;
    try {
      session = JSON.parse(sessionCookie) as SessionCookie;
    } catch {
      return NextResponse.json({ error: "Invalid session format" }, { status: 401 });
    }

    if (!session.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const contacts = await Contact.find({ userId: session.id })
      .sort({ updatedAt: -1 })
      .select({ name: 1, mobiles: 1, email: 1, avatar: 1, createdAt: 1, updatedAt: 1 })
      .lean();

    const extractedMobiles = contacts
      .flatMap((item: any) => (Array.isArray(item.mobiles) ? item.mobiles : []))
      .filter(Boolean);

    const registeredUsers = extractedMobiles.length
      ? await User.find({ mobile: { $in: extractedMobiles } }, { mobile: 1 })
          .lean()
      : [];

    const registeredNumbers = new Set(registeredUsers.map((u: any) => u.mobile));

    const mobileToId: Record<string, string> = {};
    registeredUsers.forEach((u: any) => {
      mobileToId[u.mobile] = u._id.toString();
    });

    const candidateUserIds: string[] = [];
    const perContactUserId: Record<string, string> = {};

    for (const c of contacts) {
      const mobiles = Array.isArray((c as any).mobiles) ? (c as any).mobiles : [];
      let uid = "";
      for (const m of mobiles) {
        const found = mobileToId[m];
        if (found) { uid = found; break; }
      }
      if (uid) {
        perContactUserId[String((c as any)._id)] = uid;
        candidateUserIds.push(uid);
      }
    }

    const uniqueUserIds = Array.from(new Set(candidateUserIds));
    const profiles = uniqueUserIds.length
      ? await Profile.find({ userId: { $in: uniqueUserIds } }, { userId: 1, name: 1, photo: 1 }).lean()
      : [];
    const profileMap = new Map<string, any>();
    profiles.forEach((p: any) => profileMap.set(String(p.userId), p));

    const payload = contacts.map((contactObj: any) => {
      const mobiles = Array.isArray(contactObj.mobiles) ? contactObj.mobiles : [];
      const cid = String(contactObj._id);
      const registeredUserId = perContactUserId[cid] || "";
      const prof = registeredUserId ? profileMap.get(registeredUserId) : null;
      const registeredProfile = prof ? { name: prof.name, photo: prof.photo } : null;
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
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: SessionCookie;
    try {
      session = JSON.parse(sessionCookie) as SessionCookie;
    } catch {
      return NextResponse.json({ error: "Invalid session format" }, { status: 401 });
    }

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as ContactPayload;

    const name = body?.name?.trim();
    const mobiles = Array.isArray(body?.mobiles) ? body.mobiles.map(String) : [];
    const email = body?.email?.trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    if (!mobiles.length) {
      return NextResponse.json({ error: "At least one mobile number is required" }, { status: 400 });
    }

    const cleanedMobiles = mobiles
      .map((m) => m.replace(/\D/g, ""))
      .filter((m) => /^\d{10}$/.test(m));

    if (!cleanedMobiles.length) {
      return NextResponse.json({ error: "Provide valid 10-digit mobile numbers" }, { status: 400 });
    }

    await connectDB();

    const newContact = await Contact.create({
      userId: session.id,
      name,
      mobiles: cleanedMobiles,
      email,
    });

    return NextResponse.json({ contact: newContact }, { status: 201 });
  } catch (error: any) {
    console.error("POST /contacts error →", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: SessionCookie;
    try {
      session = JSON.parse(sessionCookie) as SessionCookie;
    } catch {
      return NextResponse.json({ error: "Invalid session format" }, { status: 401 });
    }

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Contact id required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    await connectDB();

    const contact = await Contact.findOneAndUpdate(
      { _id: id, userId: session.id },
      { $set: { name } },
      { new: true }
    );

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ contact }, { status: 200 });
  } catch (error: any) {
    console.error("PATCH /contacts error →", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const sessionCookie = req.cookies.get("user_session")?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let session: SessionCookie;
    try {
      session = JSON.parse(sessionCookie) as SessionCookie;
    } catch {
      return NextResponse.json({ error: "Invalid session format" }, { status: 401 });
    }

    if (!session?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const id = String(body?.id || "");
    if (!id) {
      return NextResponse.json({ error: "Contact id required" }, { status: 400 });
    }

    await connectDB();

    const deleted = await Contact.findOneAndDelete({ _id: id, userId: session.id });
    if (!deleted) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (error: any) {
    console.error("DELETE /contacts error →", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}
