import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db/db";
import User from "@/models/user/User";
import Contact from "@/models/contact/Contact";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const token = await tokenRes.json();
  if (!token.access_token)
    return NextResponse.json({ error: "Token error" }, { status: 400 });

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("user_session")?.value;
  if (!sessionCookie) {
    return NextResponse.redirect("/login");
  }

  let session;
  try {
    session = JSON.parse(sessionCookie);
  } catch {
    return NextResponse.redirect("/login");
  }

  if (!session?.id) {
    return NextResponse.redirect("/login");
  }

  await connectDB();

  const user = await User.findById(session.id);
  if (!user) {
    return NextResponse.redirect("/login");
  }

  user.googleAccessToken = token.access_token;
  if (token.refresh_token) {
    user.googleRefreshToken = token.refresh_token;
  }
  if (token.expires_in) {
    user.googleTokenExpiry = Date.now() + token.expires_in * 1000;
  }
  await user.save();

  const contactsRes = await fetch(
    "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
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

  return NextResponse.redirect("/contacts");
}
