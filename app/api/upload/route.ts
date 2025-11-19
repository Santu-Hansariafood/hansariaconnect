import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export const runtime = "nodejs"

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET

    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
      return NextResponse.json({ error: "Missing Cloudinary env" }, { status: 500 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const blob = new Blob([arrayBuffer], { type: file.type || "application/octet-stream" })

    const timestamp = Math.floor(Date.now() / 1000)
    const folder = "profiles"
    const toSign = `folder=${folder}&timestamp=${timestamp}`
    const signature = crypto
      .createHash("sha1")
      .update(toSign + CLOUDINARY_API_SECRET)
      .digest("hex")

    const cloudForm = new FormData()
    cloudForm.append("file", blob, file.name)
    cloudForm.append("api_key", CLOUDINARY_API_KEY)
    cloudForm.append("timestamp", String(timestamp))
    cloudForm.append("signature", signature)
    cloudForm.append("folder", folder)

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: "POST", body: cloudForm }
    )
    const contentType = uploadRes.headers.get("content-type") || ""
    const uploadJson = contentType.includes("application/json") ? await uploadRes.json() : null
    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: uploadJson?.error?.message || "Upload failed" },
        { status: uploadRes.status }
      )
    }

    const originalUrl: string = uploadJson.secure_url
    const webpUrl = originalUrl.replace("/upload/", "/upload/f_webp/")

    return NextResponse.json({
      public_id: uploadJson.public_id,
      url: webpUrl,
      original_url: originalUrl,
      resource_type: uploadJson.resource_type,
      format: "webp",
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}