import { NextResponse } from "next/server";

/**
 * Public API surface used by other applications (Admin > Application Connection).
 * These routes authenticate with `Authorization: Bearer <api key>` and never use
 * cookies, so the wildcard origin is safe: browsers will not attach credentials.
 */
export const API_CORS_ORIGIN = "*";

const API_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": API_CORS_ORIGIN,
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

export function applyApiCors(headers: Headers): void {
  for (const [key, value] of Object.entries(API_CORS_HEADERS)) {
    headers.set(key, value);
  }
}

/** Answers the browser preflight so cross-origin callers never see a 405. */
export function apiPreflightResponse(): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  applyApiCors(response.headers);
  return response;
}
