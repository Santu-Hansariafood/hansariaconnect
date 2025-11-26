import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")

  if (!code) return NextResponse.json({ error: "No code" }, { status: 400 })

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
  })

  const token = await tokenRes.json()
  if (!token.access_token)
    return NextResponse.json({ error: "Token error" }, { status: 400 })

  const contactsRes = await fetch(
    "https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers,emailAddresses",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    }
  )

  const contactsData = await contactsRes.json()

  // Format contacts
  const importedContacts = (contactsData.connections || []).map((p: any) => ({
    name: p.names?.[0]?.displayName || "Unknown",
    mobiles:
      p.phoneNumbers?.map((ph: any) =>
        (ph.value || "").replace(/\D/g, "")
      ) || [],
    email: p.emailAddresses?.[0]?.value || "",
  }))

  // Optional: Save to DB or return to frontend
  return NextResponse.redirect(
    `/contacts?imported=${encodeURIComponent(JSON.stringify(importedContacts))}`
  )
}
