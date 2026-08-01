import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Contact from "@/models/contact/Contact";
import { getUserSession } from "@/lib/sessionAuth";

export async function POST(req: NextRequest) {
  const session = getUserSession(req);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findById(session.id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let accessToken = user.googleAccessToken;
  if (
    !accessToken ||
    (user.googleTokenExpiry && Date.now() > user.googleTokenExpiry - 300000)
  ) {
    if (user.googleRefreshToken) {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: user.googleRefreshToken,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          grant_type: "refresh_token",
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        accessToken = tokenData.access_token;
        user.googleAccessToken = accessToken;
        if (tokenData.expires_in) {
          user.googleTokenExpiry = Date.now() + tokenData.expires_in * 1000;
        }
        await user.save();
      } else {
        return NextResponse.json(
          { error: "Token expired, re-authenticate" },
          { status: 401 },
        );
      }
    } else {
      return NextResponse.json({ error: "No tokens found" }, { status: 404 });
    }
  }

  const contactsRes = await fetch(
    "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  const contactsData = await contactsRes.json();
  const importedContacts = (contactsData.connections || []).map((p: any) => ({
    name: p.names?.[0]?.displayName || "Unknown",
    mobiles:
      p.phoneNumbers?.map((ph: any) => (ph.value || "").replace(/\D/g, "")) ||
      [],
    email: p.emailAddresses?.[0]?.value || "",
  }));

  for (const contact of importedContacts) {
    const hasValidMobile = contact.mobiles?.some(
      (m: string) => m.length === 10,
    );
    if (!hasValidMobile) continue;

    const existing = await Contact.findOne({
      userId: user._id,
      $or: contact.mobiles.map((m: string) => ({ mobiles: { $in: [m] } })),
    });
    if (existing) continue;

    await Contact.create({
      userId: user._id,
      name: contact.name,
      mobiles: contact.mobiles,
      email: contact.email,
    });
  }

  return NextResponse.json({ success: true });
}
