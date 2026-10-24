import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api/request";

export const runtime = "nodejs";

const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 512 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_LIMIT = 200;

type LinkPreview = {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
};

const previewCache = new Map<string, { preview: LinkPreview; expiresAt: number }>();
const inflightPreviews = new Map<string, Promise<LinkPreview>>();

/**
 * Hostnames that must never be reached from the server: a preview URL is user
 * supplied, so without this an attacker could probe the internal network
 * (localhost, RFC1918 ranges, cloud metadata) through our own process.
 */
const BLOCKED_HOSTNAMES = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\./i,
];

const isBlockedHostname = (hostname: string) =>
  BLOCKED_HOSTNAMES.some((pattern) => pattern.test(hostname));

const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  "#x27": "'",
  "#x2F": "/",
};

const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const named = HTML_ENTITIES[entity] ?? HTML_ENTITIES[entity.toLowerCase()];
    if (named) return named;
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const codePoint = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (entity.startsWith("#")) {
      const codePoint = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return match;
  });

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

const readAttribute = (tag: string, attribute: string): string | undefined => {
  const match = tag.match(
    new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"),
  );
  const raw = match?.[1] ?? match?.[2] ?? match?.[3];
  return raw === undefined ? undefined : collapseWhitespace(decodeHtmlEntities(raw));
};

const parseHtmlMetadata = (html: string) => {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];
  const meta = new Map<string, string>();

  for (const tag of metaTags) {
    const key = (readAttribute(tag, "property") || readAttribute(tag, "name") || "").toLowerCase();
    const content = readAttribute(tag, "content");
    if (key && content && !meta.has(key)) {
      meta.set(key, content);
    }
  }

  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  return {
    title:
      meta.get("og:title") ||
      meta.get("twitter:title") ||
      (titleTag ? collapseWhitespace(decodeHtmlEntities(titleTag)) : ""),
    description:
      meta.get("og:description") ||
      meta.get("twitter:description") ||
      meta.get("description") ||
      "",
    image:
      meta.get("og:image:secure_url") ||
      meta.get("og:image") ||
      meta.get("twitter:image") ||
      "",
    siteName: meta.get("og:site_name") || meta.get("application-name") || "",
  };
};

/** Reads at most `MAX_HTML_BYTES` so a huge page cannot exhaust server memory. */
const readLimitedBody = async (response: Response) => {
  const body = response.body;
  if (!body) return "";

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let received = 0;
  let html = "";

  while (received < MAX_HTML_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    html += decoder.decode(value, { stream: true });
    // Most pages put their <head> metadata in the first few KB.
    if (/<\/head>/i.test(html) || /<\/html>/i.test(html)) break;
  }

  reader.cancel().catch(() => undefined);
  return html;
};

const buildPreview = async (target: URL): Promise<LinkPreview> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(target.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Some sites serve a bare page (or refuse) without a browser-like agent.
        "User-Agent":
          "Mozilla/5.0 (compatible; HansariaConnectBot/1.0; +https://hansaria.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      return { url: target.toString() };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml/i.test(contentType)) {
      return { url: target.toString() };
    }

    const html = await readLimitedBody(response);
    const metadata = parseHtmlMetadata(html);

    let image = metadata.image;
    if (image) {
      try {
        image = new URL(image, response.url || target.toString()).toString();
      } catch {
        image = "";
      }
    }

    return {
      url: response.url || target.toString(),
      title: metadata.title || undefined,
      description: metadata.description || undefined,
      image: image || undefined,
      siteName: metadata.siteName || undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const getCachedPreview = (key: string) => {
  const cached = previewCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    previewCache.delete(key);
    return null;
  }
  return cached.preview;
};

const storePreview = (key: string, preview: LinkPreview) => {
  if (previewCache.size >= CACHE_LIMIT) {
    const oldestKey = previewCache.keys().next().value;
    if (oldestKey) previewCache.delete(oldestKey);
  }
  previewCache.set(key, { preview, expiresAt: Date.now() + CACHE_TTL_MS });
};

export async function GET(req: NextRequest) {
  const session = await requireUser(req);
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url")?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "A url query parameter is required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`);
  } catch {
    return NextResponse.json({ error: "That link is not a valid URL" }, { status: 400 });
  }

  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return NextResponse.json({ error: "Only http and https links can be previewed" }, { status: 400 });
  }

  if (isBlockedHostname(target.hostname)) {
    return NextResponse.json({ error: "That link cannot be previewed" }, { status: 400 });
  }

  const cacheKey = target.toString();
  const cached = getCachedPreview(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const pending =
    inflightPreviews.get(cacheKey) ??
    buildPreview(target).finally(() => inflightPreviews.delete(cacheKey));
  inflightPreviews.set(cacheKey, pending);

  try {
    const preview = await pending;
    // Only cache pages that actually yielded something worth showing.
    if (preview.title || preview.description || preview.image) {
      storePreview(cacheKey, preview);
    }
    return NextResponse.json(preview);
  } catch (error) {
    console.warn(
      "[link-preview] Could not build a preview for",
      cacheKey,
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ url: cacheKey });
  }
}
