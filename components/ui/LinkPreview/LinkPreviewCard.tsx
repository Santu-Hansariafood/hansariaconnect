"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { useLinkPreview } from "@/hooks/useLinkPreview";

interface LinkPreviewCardProps {
  url: string;
  /** Metadata already attached by the sender takes precedence over a fetched preview. */
  providedTitle?: string;
  providedDescription?: string;
  /**
   * Standalone link messages always show a card (domain + URL), while a card
   * inside a text bubble is only worth showing once it adds something the text
   * itself does not already show.
   */
  alwaysShow?: boolean;
}

const getDomain = (value: string) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return value;
  }
};

export default function LinkPreviewCard({
  url,
  providedTitle,
  providedDescription,
  alwaysShow = false,
}: LinkPreviewCardProps) {
  const { preview } = useLinkPreview(url);
  const [imageFailed, setImageFailed] = useState(false);

  const domain = getDomain(preview?.url || url);
  const title = providedTitle || preview?.title || domain;
  const description = providedDescription || preview?.description;
  const image = imageFailed ? undefined : preview?.image;

  if (!alwaysShow && !providedTitle && !providedDescription && !image) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="mb-2 block min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-[var(--chat-border)] bg-[var(--chat-glass-surface)] text-left text-[var(--chat-text)] transition hover:bg-[var(--chat-glass-hover)]"
    >
      {image && (
        <span className="block h-40 w-full overflow-hidden bg-black/5 sm:h-44">
          {/* Preview thumbnails come from arbitrary third-party hosts, which the
              Next.js image optimiser cannot be configured for ahead of time. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        </span>
      )}

      <span className="block space-y-1 px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--chat-muted)]">
          <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{preview?.siteName || domain}</span>
        </span>

        {title && (
          <span className="block line-clamp-2 text-[13.5px] font-semibold leading-[18px] text-[var(--chat-text)]">
            {title}
          </span>
        )}

        {description && (
          <span className="block line-clamp-3 text-[13px] leading-[18px] text-[var(--chat-muted)]">
            {description}
          </span>
        )}

        {alwaysShow && (
          <span className="block truncate text-[12px] text-[var(--chat-muted)]">{url}</span>
        )}
      </span>
    </a>
  );
}
