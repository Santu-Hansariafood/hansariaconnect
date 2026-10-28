import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import { getUserSession } from "@/lib/sessionAuth";
import Contact from "@/models/contact/Contact";
import User from "@/models/user/User";

type GooglePerson = {
  names?: Array<{ displayName?: string }>;
  phoneNumbers?: Array<{ value?: string }>;
  emailAddresses?: Array<{ value?: string }>;
};

export async function POST(req: NextRequest) {
  const session = await getUserSession(req);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let confirmed = false;
  try {
    const body = await req.json();
    confirmed = body?.confirm === true;
  } catch {}

  if (!confirmed) {
    return NextResponse.json({ error: "Import not confirmed" }, { status: 400 });
  }

  await connectDB();

  const user = await User.findById(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let accessToken = user.googleAccessToken;
  if (
    !accessToken ||
    !user.googleTokenExpiry ||
    Date.now() > user.googleTokenExpiry - 300000
  ) {
    if (!user.googleRefreshToken) {
      return NextResponse.json(
        { error: "Reconnect your Google account to import contacts." },
        { status: 401 },
      );
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google Contacts import is not configured." },
        { status: 503 },
      );
    }

    let tokenRes: Response;
    try {
      tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: user.googleRefreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
        }),
      });
    } catch (error) {
      console.error("[Google Contacts] Could not refresh authorization:", error);
      return NextResponse.json(
        { error: "Could not connect to Google. Please try again." },
        { status: 502 },
      );
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!tokenRes.ok || !tokenData.access_token) {
      return NextResponse.json(
        { error: "Google authorization expired. Reconnect your Google account." },
        { status: 401 },
      );
    }

    accessToken = tokenData.access_token;
    user.googleAccessToken = accessToken;
    if (tokenData.expires_in) {
      user.googleTokenExpiry = Date.now() + tokenData.expires_in * 1000;
    }
    await user.save();
  }

  const googleContacts: GooglePerson[] = [];
  let nextPageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      personFields: "names,phoneNumbers,emailAddresses",
      pageSize: "1000",
    });
    if (nextPageToken) params.set("pageToken", nextPageToken);

    let contactsRes: Response;
    try {
      contactsRes = await fetch(
        `https://people.googleapis.com/v1/people/me/connections?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
    } catch (error) {
      console.error("[Google Contacts] Could not reach People API:", error);
      return NextResponse.json(
        { error: "Could not reach Google Contacts. Please try again." },
        { status: 502 },
      );
    }

    const contactsData = (await contactsRes.json()) as {
      connections?: GooglePerson[];
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!contactsRes.ok) {
      console.error(
        "[Google Contacts] People API request failed:",
        contactsRes.status,
        contactsData?.error?.message || contactsData?.error,
      );
      return NextResponse.json(
        {
          error:
            contactsRes.status === 401
              ? "Google authorization expired. Reconnect your Google account and try again."
              : contactsRes.status === 403
                ? "Google denied Contacts access. Check that the People API is enabled, then reconnect your Google account."
              : "Google could not return your contacts. Please try again.",
        },
        { status: contactsRes.status === 401 ? 401 : 502 },
      );
    }

    googleContacts.push(...(contactsData.connections || []));
    nextPageToken = contactsData.nextPageToken;
  } while (nextPageToken);

  const existingContacts = await Contact.find(
    {
      userId: user._id,
      mobiles: {
        $in: googleContacts.flatMap((person) =>
          (person.phoneNumbers || [])
            .map((phone) => normalizeIndianMobile(phone.value))
            .filter((mobile): mobile is string => mobile !== null),
        ),
      },
    },
    { mobiles: 1 },
  ).lean();
  const existingMobiles = new Set(
    existingContacts.flatMap((contact) => contact.mobiles),
  );
  const seenMobiles = new Set<string>();
  const imports: Array<{
    userId: typeof user._id;
    name: string;
    mobiles: string[];
    email: string;
  }> = [];
  let skippedExistingCount = 0;
  let skippedInvalidCount = 0;

  for (const person of googleContacts) {
    const mobiles = Array.from(
      new Set(
        (person.phoneNumbers || [])
          .map((phone) => normalizeIndianMobile(phone.value))
          .filter((mobile): mobile is string => mobile !== null),
      ),
    );
    if (!mobiles.length) {
      skippedInvalidCount += 1;
      continue;
    }

    if (
      mobiles.some(
        (mobile) => existingMobiles.has(mobile) || seenMobiles.has(mobile),
      )
    ) {
      skippedExistingCount += 1;
      continue;
    }

    mobiles.forEach((mobile) => seenMobiles.add(mobile));
    imports.push({
      userId: user._id,
      name: person.names?.[0]?.displayName || "Unknown",
      mobiles,
      email: person.emailAddresses?.[0]?.value || "",
    });
  }

  const inserted = imports.length
    ? await Contact.insertMany(imports, { ordered: true })
    : [];

  return NextResponse.json({
    success: true,
    importedCount: inserted.length,
    skippedExistingCount,
    skippedInvalidCount,
  });
}
