import { NextResponse } from "next/server";

const configuredOrigins = process.env.API_CORS_ALLOWED_ORIGINS?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function normalizeConfiguredOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      `Invalid origin in API_CORS_ALLOWED_ORIGINS: ${JSON.stringify(value)}`,
    );
  }
  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `API_CORS_ALLOWED_ORIGINS entries must be HTTP(S) origins: ${JSON.stringify(value)}`,
    );
  }
  return url.origin;
}

const allowedOrigins = configuredOrigins?.map(normalizeConfiguredOrigin) ?? [];

export function getApiCorsOrigin(requestOrigin: string | null): string | null {
  if (allowedOrigins.length === 0 || !requestOrigin) return null;

  try {
    const url = new URL(requestOrigin);
    if (url.origin !== requestOrigin) return null;
    return allowedOrigins.includes(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

const API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Expose-Headers": [
    "X-RateLimit-Request-Limit",
    "X-RateLimit-Requests-Remaining",
    "X-RateLimit-Message-Limit",
    "X-RateLimit-Messages-Remaining",
    "X-RateLimit-Reset",
    "Retry-After",
  ].join(", "),
  "Access-Control-Max-Age": "86400",
};

export function applyApiCors(
  headers: Headers,
  requestOrigin: string | null,
): void {
  const allowedOrigin = getApiCorsOrigin(requestOrigin);
  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  } else {
    headers.delete("Access-Control-Allow-Origin");
  }

  if (allowedOrigins.length > 0) {
    const varyValues =
      headers.get("Vary")?.split(",").map((value) => value.trim()) ?? [];
    if (
      !varyValues.includes("*") &&
      !varyValues.some((value) => value.toLowerCase() === "origin")
    ) {
      headers.set("Vary", [...varyValues, "Origin"].filter(Boolean).join(", "));
    }
  }

  for (const [key, value] of Object.entries(API_CORS_HEADERS)) {
    headers.set(key, value);
  }
}

/** Answers the browser preflight so cross-origin callers never see a 405. */
export function apiPreflightResponse(
  requestOrigin: string | null,
): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  applyApiCors(response.headers, requestOrigin);
  return response;
}
