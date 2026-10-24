"use client";

import { useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { format } from "date-fns";
import { ChevronLeft, Download, X } from "lucide-react";

export interface MediaViewerItem {
  kind: "image" | "video";
  url: string;
  caption?: string;
  senderName?: string;
  timestamp?: string | Date;
  fileName?: string;
}

interface MediaViewerProps {
  item: MediaViewerItem | null;
  onClose: () => void;
}

/**
 * WhatsApp-style full-screen media preview: dark backdrop, the media zoomed to
 * fit, and a header that carries the sender, the time and the download action.
 */
export default function MediaViewer({ item, onClose }: MediaViewerProps) {
  const handleClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (!item) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };

    // Freeze the page behind the viewer so scrolling cannot leak through.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [item, handleClose]);

  if (!item) return null;
  if (typeof document === "undefined") return null;

  const timestamp = item.timestamp ? new Date(item.timestamp) : null;
  const hasCaption = Boolean(item.caption || item.senderName || timestamp);

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="media-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        className="fixed inset-0 z-[9999] flex flex-col bg-[#0b141a]/97 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={item.kind === "video" ? "Video preview" : "Image preview"}
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)] text-white">
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close preview"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          <div className="min-w-0 flex-1">
            {item.senderName && (
              <p className="truncate text-sm font-medium">{item.senderName}</p>
            )}
            {timestamp && (
              <p className="truncate text-xs text-white/70">
                {format(timestamp, "h:mm a").toLowerCase()}
              </p>
            )}
          </div>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            download={item.fileName || true}
            aria-label="Download media"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <Download className="h-5 w-5" />
          </a>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close preview"
            className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:flex"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          onClick={handleClose}
          className="flex min-h-0 flex-1 items-center justify-center px-2 pb-2"
        >
          {item.kind === "video" ? (
            <video
              src={item.url}
              controls
              autoPlay
              playsInline
              preload="metadata"
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-lg bg-black"
            />
          ) : (
            /* Media URLs are runtime uploads, so the raw element keeps the
               intrinsic aspect ratio without a fixed sizing box. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={item.url}
              alt={item.caption || "Shared image"}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
        </motion.div>

        {hasCaption && (
          <div className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 text-white">
            {item.caption && (
              <p className="mx-auto max-w-3xl whitespace-pre-wrap break-words text-sm leading-5">
                {item.caption}
              </p>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
