import { NextRequest, NextResponse } from "next/server";
import { digestHex } from "@/lib/crypto";
import harmfulWordsJson from "@/data/harmfulWords.json";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = [
  "image/",
  "video/",
  "audio/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
];

const BLOCKED_EXTENSIONS = [
  ".zip",
  ".rar",
  ".7z",
  ".apk",
  ".exe",
  ".bat",
  ".cmd",
  ".sh",
  ".dll",
  ".sys",
  ".msi",
];

const harmfulWords = harmfulWordsJson.words.map((word) => word.toLowerCase());

const hasHarmfulFileName = (fileName: string) =>
  harmfulWords.some((word) =>
    new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}(?=[^a-z0-9]|$)`, "i").test(fileName),
  );

const hasValidSignature = (bytes: Uint8Array, fileName: string, mime: string) => {
  if (bytes.length < 4) return false;
  const startsWith = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (mime === "application/pdf" || extension === ".pdf") return startsWith(0x25, 0x50, 0x44, 0x46);
  if (mime.startsWith("image/png") || extension === ".png") return startsWith(0x89, 0x50, 0x4e, 0x47);
  if (mime.startsWith("image/jpeg") || extension === ".jpg" || extension === ".jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (mime.startsWith("image/gif") || extension === ".gif") return startsWith(0x47, 0x49, 0x46, 0x38);
  if (mime.includes("spreadsheet") || extension === ".xlsx" || extension === ".xls") return startsWith(0x50, 0x4b, 0x03, 0x04) || extension === ".xls";
  if (mime === "application/msword" || extension === ".doc") return startsWith(0xd0, 0xcf, 0x11, 0xe0);
  if (mime.includes("wordprocessingml") || extension === ".docx") return startsWith(0x50, 0x4b, 0x03, 0x04);
  if (mime.startsWith("text/") || extension === ".txt" || extension === ".csv") {
    return !bytes.subarray(0, 4096).some((byte) => byte === 0);
  }
  return true;
};

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = (form.get("kind") as string) || "image";

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const fileMime = file.type.toLowerCase();

    if (hasHarmfulFileName(fileName)) {
      return NextResponse.json({ error: "This file name contains unsafe content" }, { status: 400 });
    }

    if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: "File is empty or exceeds the 50 MB limit" }, { status: 400 });
    }

    const hasBlockedExtension = BLOCKED_EXTENSIONS.some((ext) =>
      fileName.endsWith(ext),
    );
    if (hasBlockedExtension) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 },
      );
    }

    const isAllowedMime = ALLOWED_MIME_TYPES.some((type) =>
      fileMime.startsWith(type),
    );
    if (!isAllowedMime) {
      const isImageByExtension = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".bmp",
        ".webp",
        ".svg",
        ".pdf",
        ".doc",
        ".docx",
        ".xlsx",
        ".xls",
        ".txt",
        ".csv",
        ".mp4",
        ".webm",
        ".mov",
        ".mp3",
        ".wav",
        ".ogg",
        ".aac",
      ].some((ext) => fileName.endsWith(ext));
      if (!isImageByExtension) {
        return NextResponse.json(
          { error: "File type not allowed" },
          { status: 400 },
        );
      }
    }

    const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

    if (
      !CLOUDINARY_CLOUD_NAME ||
      !CLOUDINARY_API_KEY ||
      !CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Missing Cloudinary env" },
        { status: 500 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!hasValidSignature(new Uint8Array(arrayBuffer), fileName, fileMime)) {
      return NextResponse.json({ error: "File appears corrupt or does not match its extension" }, { status: 400 });
    }
    const blob = new Blob([arrayBuffer], {
      type: file.type || "application/octet-stream",
    });

    const timestamp = Math.floor(Date.now() / 1000);

    let folder = "profiles";
    if (kind === "status") folder = "status";
    else if (kind === "video") folder = "messages";
    else if (kind === "raw" || kind === "file") folder = "rawfiles";

    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = await digestHex("SHA-1", toSign + CLOUDINARY_API_SECRET);

    const isVideoFile = file.type.startsWith("video/");

    const resourceType =
      kind === "status"
        ? isVideoFile
          ? "video"
          : "image"
        : kind === "video"
          ? "video"
          : kind === "raw" || kind === "file"
            ? "raw"
            : "image";

    const cloudForm = new FormData();
    cloudForm.append("file", blob, file.name);
    cloudForm.append("api_key", CLOUDINARY_API_KEY);
    cloudForm.append("timestamp", String(timestamp));
    cloudForm.append("signature", signature);
    cloudForm.append("folder", folder);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      { method: "POST", body: cloudForm },
    );

    const contentType = uploadRes.headers.get("content-type") || "";
    const uploadJson = contentType.includes("application/json")
      ? await uploadRes.json()
      : null;

    if (!uploadRes.ok) {
      return NextResponse.json(
        { error: uploadJson?.error?.message || "Upload failed" },
        { status: uploadRes.status },
      );
    }

    const originalUrl: string = uploadJson.secure_url;
    const isImage = resourceType === "image";
    const url = isImage
      ? originalUrl.replace("/upload/", "/upload/f_webp/")
      : originalUrl;

    return NextResponse.json({
      public_id: uploadJson.public_id,
      url,
      original_url: originalUrl,
      resource_type: uploadJson.resource_type,
      format: isImage ? "webp" : uploadJson.format,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error" },
      { status: 500 },
    );
  }
}
