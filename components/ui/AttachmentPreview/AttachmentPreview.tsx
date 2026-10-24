"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { File as FileIcon, FileSpreadsheet, FileText, Send, X } from "lucide-react";

export type PendingAttachment = {
  file: File;
  type: "image" | "video" | "pdf" | "excel" | "file";
  /** Unique per attachment so a new preview mounts with an empty caption. */
  id: string;
  /** Object URL for image/video attachments; nothing for documents. */
  previewUrl?: string;
  duration?: number;
};

interface AttachmentPreviewProps {
  attachment: PendingAttachment | null;
  sending: boolean;
  error?: string;
  theme: { primary: string };
  onCancel: () => void;
  onSend: (caption: string) => void;
}

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

const documentIcon = (type: PendingAttachment["type"]) => {
  if (type === "pdf") return { Icon: FileText, tint: "bg-red-500" };
  if (type === "excel") return { Icon: FileSpreadsheet, tint: "bg-emerald-600" };
  return { Icon: FileIcon, tint: "bg-slate-500" };
};

/**
 * WhatsApp's pre-send screen: you see what you are about to send, may add a
 * caption to it, and nothing leaves the device until you confirm.
 */
export default function AttachmentPreview({
  attachment,
  sending,
  error,
  theme,
  onCancel,
  onSend,
}: AttachmentPreviewProps) {
  const [caption, setCaption] = useState("");

  useEffect(() => {
    if (!attachment) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachment, onCancel]);

  if (!attachment) return null;

  const { Icon, tint } = documentIcon(attachment.type);

  return (
    <AnimatePresence>
      <motion.div
        key="attachment-preview"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="fixed inset-0 z-[9998] flex flex-col bg-[#0b141a]/95 backdrop-blur-sm"
      >
        <div className="flex items-center gap-2 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.6rem)] text-white">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel attachment"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-medium">
            {attachment.type === "image"
              ? "Photo"
              : attachment.type === "video"
                ? "Video"
                : attachment.file.name}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center px-2">
          {attachment.type === "image" && attachment.previewUrl ? (
            /* The preview is a local object URL, so the Next.js image optimiser
               has nothing to do here. */
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={attachment.previewUrl}
              alt="Attachment preview"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          ) : attachment.type === "video" && attachment.previewUrl ? (
            <video
              src={attachment.previewUrl}
              controls
              playsInline
              preload="metadata"
              className="max-h-full max-w-full rounded-lg bg-black"
            />
          ) : (
            <div className="flex w-full max-w-sm items-center gap-3 rounded-xl bg-white/95 p-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white ${tint}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#111b21]">
                  {attachment.file.name}
                </p>
                <p className="text-xs text-[#667781]">
                  {formatSize(attachment.file.size)}
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="px-4 pb-1 text-sm text-red-300" role="alert">
            {error}
          </p>
        )}

        <div className="px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <textarea
              rows={1}
              value={caption}
              onChange={(event) => {
                setCaption(event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 120)}px`;
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  if (!sending) onSend(caption.trim());
                }
              }}
              placeholder="Add a caption..."
              aria-label="Attachment caption"
              className="max-h-32 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-[22px] border border-white/20 bg-white/10 px-4 py-2.5 text-base leading-5 text-white outline-none placeholder:text-white/60 focus:border-[var(--brand-primary)] sm:text-[15px]"
            />

            <button
              type="button"
              onClick={() => onSend(caption.trim())}
              disabled={sending}
              style={{ backgroundColor: theme.primary }}
              aria-label="Send attachment"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition hover:brightness-105 disabled:opacity-60"
            >
              {sending ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <Send className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
