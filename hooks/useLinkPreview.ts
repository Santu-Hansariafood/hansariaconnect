"use client";

import { useEffect, useState } from "react";
import { extractLinks, validateUrl } from "@/utils/text/formatting";

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/**
 * Shared across every bubble on the page: the same link pasted in ten chats is
 * fetched exactly once, and a link scrolled back into view renders straight
 * from this cache without touching the network again.
 */
const previewCache = new Map<string, LinkPreviewData | null>();
const inflightPreviews = new Map<string, Promise<LinkPreviewData | null>>();

/** Trailing punctuation belongs to the sentence, not to the URL. */
const trimUrl = (raw: string) => raw.replace(/[.,;:!?)\]}'"]+$/, "");

export const normalizeLinkUrl = (raw: string) => {
  const trimmed = trimUrl(raw.trim());
  if (!trimmed) return null;
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return validateUrl(withProtocol) ? withProtocol : null;
};

/** First real, previewable link inside a blob of message text. */
export const findPreviewableLink = (text?: string | null): string | null => {
  if (!text) return null;
  for (const candidate of extractLinks(text)) {
    const normalized = normalizeLinkUrl(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const requestPreview = (url: string): Promise<LinkPreviewData | null> => {
  const cached = previewCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);

  const inflight = inflightPreviews.get(url);
  if (inflight) return inflight;

  const request = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`, {
    credentials: "include",
    cache: "force-cache",
  })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as LinkPreviewData;
      // A card with nothing but a URL is worse than no card at all.
      const usable = data && (data.title || data.description || data.image) ? data : null;
      previewCache.set(url, usable);
      return usable;
    })
    .catch(() => {
      previewCache.set(url, null);
      return null;
    })
    .finally(() => {
      inflightPreviews.delete(url);
    });

  inflightPreviews.set(url, request);
  return request;
};

/**
 * Resolves a WhatsApp-style preview card for a link. Returns `null` while the
 * metadata is unknown, so callers can simply render nothing.
 */
export const useLinkPreview = (url?: string | null) => {
  const [resolved, setResolved] = useState<{ url: string; data: LinkPreviewData | null } | null>(null);
  const normalized = url ? normalizeLinkUrl(url) : null;

  useEffect(() => {
    if (!normalized || previewCache.has(normalized)) return;

    let cancelled = false;
    void requestPreview(normalized).then((data) => {
      if (!cancelled) setResolved({ url: normalized, data });
    });

    return () => {
      cancelled = true;
    };
  }, [normalized]);

  // Reading the shared cache during render is what makes a re-opened chat render
  // its previews on the very first frame instead of after a network round trip.
  const cached = normalized ? previewCache.get(normalized) : undefined;
  const preview =
    normalized === null
      ? null
      : cached !== undefined
        ? cached
        : resolved?.url === normalized
          ? resolved.data
          : null;

  return {
    preview,
    loading: normalized !== null && cached === undefined && resolved?.url !== normalized,
  };
};
