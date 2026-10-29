"use client"

import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  Download,
  Play,
  FileText,
  File,
  Check,
  CheckCheck,
  Forward,
  Paperclip,
  Smile,
  MapPin,
  ExternalLink,
  Eye,
  MoreVertical,
} from "lucide-react"
import Image from "next/image"
import React, { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import LinkPreviewCard from "@/components/ui/LinkPreview/LinkPreviewCard"
import type { MediaViewerItem } from "@/components/ui/MediaViewer/MediaViewer"
import { findPreviewableLink } from "@/hooks/useLinkPreview"
import { detectHarmfulWords, formatRichText } from "@/utils/text/formatting"
import Link from "next/link"
import type { TemplateActionButton } from "@/lib/templateActionButtons";

/*
 * Per-bubble interactions are split out of the chat chunk. A bubble only pays
 * for the reaction picker, the voice player or the full-screen viewer when the
 * user actually reaches for it, which keeps the first paint of a long thread
 * light.
 */
const ReactionPicker = dynamic(
  () => import("@/components/ui/ReactionPicker/ReactionPicker"),
)
const VoicePlayer = dynamic(
  () => import("@/components/ui/VoicePlayer/VoicePlayer"),
)
const MediaViewer = dynamic(
  () => import("@/components/ui/MediaViewer/MediaViewer"),
)

interface Message {
  id?: string
  sender: "me" | "contact"
  type: "text" | "image" | "video" | "voice" | "pdf" | "excel" | "link" | "file"
  text?: string
  media?: string
  url?: string
  fileName?: string
  fileSize?: string
  linkTitle?: string
  linkDescription?: string
  timestamp: string | Date
  status?: "sent" | "delivered" | "seen" | "sending" | "failed"
  reactions?: Record<string, number>
  duration?: number
  buttons?: TemplateActionButton[]
  deletedForEveryone?: boolean
  viewOnce?: boolean
  viewedByMe?: boolean
  viewed?: boolean
}

interface User {
  name: string
}

interface Contact {
  name: string
  avatar: string
}

interface Theme {
  primary: string
  textSize?: string
}

interface MessageBubbleProps {
  message: Message
  user: User
  contact: Contact
  theme: Theme
  isGroup?: boolean
  showSenderInfo?: boolean
  onForward?: () => void
  onReaction?: (emoji: string) => Promise<boolean> | boolean
  onTemplateButton?: (
    button: TemplateActionButton,
  ) => boolean | Promise<boolean>
  onDeleteMessage?: (action: "forMe" | "forEveryone") => Promise<boolean>
  onViewOnce?: () => Promise<string | null>
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  user,
  contact,
  theme,
  isGroup = false,
  showSenderInfo = false,
  onForward,
  onReaction,
  onTemplateButton,
  onDeleteMessage,
  onViewOnce,
}) => {
  const isSent = message.sender === "me"
  const senderName = isSent ? user.name : contact.name
  const [isHovered, setIsHovered] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [showMessageActions, setShowMessageActions] = useState(false)
  const [viewOnceOpened, setViewOnceOpened] = useState(Boolean(message.viewedByMe))
  const [viewOnceVoiceUrl, setViewOnceVoiceUrl] = useState("")
  const [confirmedButtonIndexes, setConfirmedButtonIndexes] = useState<number[]>([])
  const [pendingButtonIndexes, setPendingButtonIndexes] = useState<number[]>([])
  const [templateButtonError, setTemplateButtonError] = useState("")
  const localReactions = message.reactions || {}
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)

  const textContent = message.text || ""
  const messageUrl = message.url || message.media || textContent

  const { previewLink, isMapLink, harmful, rich } = useMemo(() => {
    return {
      previewLink: findPreviewableLink(textContent),
      isMapLink:
        /(?:google\.[^/]+\/maps|maps\.google\.|openstreetmap\.org|geo:)/i.test(
          messageUrl,
        ),
      harmful: detectHarmfulWords(textContent),
      rich: formatRichText(textContent),
    }
  }, [messageUrl, textContent])

  const displaySenderAvatar = !isSent && isGroup && showSenderInfo
  const displaySenderName = !isSent && isGroup && showSenderInfo

  const messageStatusLabel =
    message.viewed && isSent
      ? "Opened"
      : message.status === "seen"
      ? "Read"
      : message.status === "delivered"
        ? "Delivered"
        : message.status === "failed"
          ? "Failed"
          : message.status === "sending"
            ? "Sending"
            : "Sent"

  const renderStatusIcon = () => {
    if (message.status === "sending") {
      return <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-500/80" />
    }

    if (message.status === "failed") {
      return <span className="text-[10px] font-medium leading-none text-red-500">Failed</span>
    }

    if (message.status === "seen") {
      return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />
    }

    if (message.status === "delivered") {
      return <CheckCheck className="h-3.5 w-3.5 text-[var(--chat-muted)]" strokeWidth={2.5} />
    }

    return <Check className="h-3.5 w-3.5 text-[var(--chat-muted)]" strokeWidth={2.5} />
  }

  const handleReaction = async (emoji: string) => {
    const saved = onReaction ? await onReaction(emoji) : true
    if (!saved) return

    setShowReactions(false)
  }

  const handleViewOnce = async (kind: "image" | "video" | "voice") => {
    if (!message.viewOnce || isSent || viewOnceOpened || !onViewOnce) return;
    const mediaUrl = await onViewOnce();
    if (!mediaUrl) return;
    setViewOnceOpened(true);
    if (kind === "image" || kind === "video") {
      setViewerItem({
        kind,
        url: mediaUrl,
        caption: message.text,
        senderName,
        timestamp: message.timestamp,
        fileName: message.fileName,
      });
    } else {
      setViewOnceVoiceUrl(mediaUrl);
    }
  };

  const handleDelete = async (action: "forMe" | "forEveryone") => {
    const prompt =
      action === "forEveryone"
        ? "Delete this message for everyone?"
        : "Delete this message for you?";
    if (!window.confirm(prompt)) return;
    const deleted = await onDeleteMessage?.(action);
    if (deleted) setShowMessageActions(false);
  };

  const handleTemplateButton = async (
    button: TemplateActionButton,
    index: number,
  ) => {
    setTemplateButtonError("");
    setPendingButtonIndexes((current) =>
      current.includes(index) ? current : [...current, index],
    );
    try {
      const completed = await onTemplateButton?.(button);
      if (button.type === "confirm" && completed) {
        setConfirmedButtonIndexes((current) =>
          current.includes(index) ? current : [...current, index],
        );
      } else if (!completed) {
        setTemplateButtonError("Action could not be completed. Please try again.");
      }
    } catch (error) {
      console.error("[MessageBubble] Template button action failed:", error);
      setTemplateButtonError("Action could not be completed. Please try again.");
    } finally {
      setPendingButtonIndexes((current) =>
        current.filter((buttonIndex) => buttonIndex !== index),
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex min-w-0 w-fit max-w-[calc(100%-0.5rem)] gap-1.5 ${
          isSent ? "flex-row-reverse" : "flex-row"
        } items-end`}
      >
        {displaySenderAvatar && (
          <Image
            src={contact.avatar || "/logo/logo.png"}
            alt={contact.name}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
          />
        )}
        {!isSent && isGroup && !showSenderInfo && (
          <div className="w-7 h-7 flex-shrink-0" />
        )}

        <div className="relative min-w-0 max-w-full">
          {(isHovered || showReactions || showMessageActions) && (
            <div
              className={`absolute -top-9 z-20 flex items-center gap-1 rounded-full border border-[var(--chat-glass-border)] bg-[var(--chat-glass-surface)] p-1 shadow-[0_8px_24px_rgba(15,23,42,0.22)] backdrop-blur-xl ${
                isSent ? "right-0" : "left-0"
              }`}
            >
              {isHovered && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    setShowReactions((prev) => !prev)
                  }}
                  aria-label="Add reaction"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--chat-glass-hover)]"
                  title="Add reaction"
                >
                  <Smile
                    className="h-4 w-4 text-[var(--chat-muted)]"
                    strokeWidth={1.8}
                  />
                </button>
              )}

              {isHovered && onForward && (
                <button
                  type="button"
                  onClick={onForward}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[var(--chat-glass-hover)]"
                  aria-label="Forward message"
                  title="Forward message"
                >
                  <Forward
                    className="h-4 w-4 text-[var(--chat-muted)]"
                    strokeWidth={1.8}
                  />
                </button>
              )}

              {onDeleteMessage &&
                !message.deletedForEveryone &&
                message.status !== "sending" &&
                message.status !== "failed" && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setShowMessageActions((shown) => !shown)
                      }}
                      aria-label="Message actions"
                      title="Message actions"
                      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--chat-glass-hover)]"
                    >
                      <MoreVertical
                        className="h-4 w-4 text-[var(--chat-muted)]"
                        strokeWidth={1.8}
                      />
                    </button>
                    {showMessageActions && (
                      <div className="absolute right-0 top-full z-50 min-w-44 overflow-hidden rounded-lg border border-[var(--chat-border)] bg-[var(--chat-surface)] py-1 text-sm text-[var(--chat-text)] shadow-xl">
                        {isSent && (
                          <button
                            type="button"
                            onClick={() => void handleDelete("forEveryone")}
                            className="block w-full px-3 py-2 text-left text-red-600 hover:bg-gray-100"
                          >
                            Delete for everyone
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDelete("forMe")}
                          className="block w-full px-3 py-2 text-left text-[var(--chat-text)] hover:bg-[var(--chat-glass-hover)]"
                        >
                          Delete for me
                        </button>
                      </div>
                    )}
                  </div>
                )}
            </div>
          )}

          <div className="relative min-w-0 max-w-full">
            {displaySenderName && (
              <p
                className="mb-1 ml-2 text-[12.8px] font-medium text-[var(--chat-text)]"
              >
                {senderName}
              </p>
            )}

            <div
              onClick={() => setShowReactions((prev) => !prev)}
              className={`cursor-pointer px-[10px] pb-[6px] pt-[7px] ${
                theme.textSize || "text-[14.2px]"
              } ${
                isSent
                  ? "rounded-2xl rounded-tr-md bg-[var(--chat-outgoing-bubble)] text-[var(--chat-text)]"
                  : "rounded-2xl rounded-tl-md bg-[var(--chat-incoming-bubble)] text-[var(--chat-text)] shadow-sm"
              } ${
                harmful.hasWarning
                  ? isSent
                    ? "ring-2 ring-red-300"
                    : "border-2 border-red-300"
                  : ""
                } relative min-w-0 max-w-full break-words leading-[19px]`}
            >
              {message.deletedForEveryone ? (
                <span className="italic text-[var(--chat-muted)]">This message was deleted</span>
              ) : null}
              {!message.deletedForEveryone && message.type === "text" && (
                <div className="break-words whitespace-pre-wrap inline">
                  {previewLink && (
                    <LinkPreviewCard
                      url={previewLink}
                      providedTitle={message.linkTitle}
                      providedDescription={message.linkDescription}
                    />
                  )}

                  <span>{rich.nodes}</span>

                  {harmful.hasWarning && (
                    <div className="mt-2 text-xs font-medium text-red-700 clear-both">
                      Harmful content detected: {harmful.warnings.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "image" && (
                <div className="space-y-2">
                  {(message.media || message.viewOnce) && (
                    <button
                      type="button"
                      disabled={
                        message.viewOnce &&
                        (isSent || viewOnceOpened || Boolean(message.viewedByMe))
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        if (message.viewOnce) {
                          void handleViewOnce("image");
                          return;
                        }
                        if (!message.media) return;
                        setViewerItem({
                          kind: "image",
                          url: message.media as string,
                          caption: message.text,
                          senderName,
                          timestamp: message.timestamp,
                        })
                      }}
                      aria-label="Open image preview"
                      className="block max-w-full cursor-zoom-in overflow-hidden rounded-lg bg-black/5 transition active:opacity-90"
                    >
                      {message.viewOnce ? (
                        <span className="flex min-h-24 min-w-40 items-center justify-center gap-2 rounded-lg bg-black/10 px-4 text-sm font-medium">
                          <Eye className="h-5 w-5" />
                          {isSent
                            ? message.viewed
                              ? "Photo opened"
                              : "Photo · View once"
                            : viewOnceOpened || message.viewedByMe
                              ? "Photo opened"
                              : "Open photo"}
                        </span>
                      ) : (
                        <Image
                          src={message.media || ""}
                          alt={message.text || "Shared image"}
                          width={400}
                          height={300}
                          className="h-auto max-h-[360px] w-auto max-w-[260px] rounded-lg object-cover sm:max-w-[320px]"
                        />
                      )}
                    </button>
                  )}

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700 clear-both">
                          Harmful content detected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "video" && (
                <div className="space-y-2">
                  {(message.media || message.viewOnce) && (
                    <button
                      type="button"
                      disabled={
                        message.viewOnce &&
                        (isSent || viewOnceOpened || Boolean(message.viewedByMe))
                      }
                      onClick={(event) => {
                        event.stopPropagation()
                        if (message.viewOnce) {
                          void handleViewOnce("video");
                          return;
                        }
                        if (!message.media) return;
                        setViewerItem({
                          kind: "video",
                          url: message.media as string,
                          caption: message.text,
                          senderName,
                          timestamp: message.timestamp,
                          fileName: message.fileName,
                        })
                      }}
                      aria-label="Open video preview"
                      className="relative block w-[240px] max-w-full cursor-pointer overflow-hidden rounded-lg bg-black sm:w-[300px]"
                    >
                      {message.viewOnce ? (
                        <span className="flex min-h-28 items-center justify-center gap-2 text-sm font-medium text-white">
                          <Eye className="h-5 w-5" />
                          {isSent
                            ? message.viewed
                              ? "Video opened"
                              : "Video · View once"
                            : viewOnceOpened || message.viewedByMe
                              ? "Video opened"
                              : "Open video"}
                        </span>
                      ) : (
                        <video
                          src={message.media || ""}
                          preload="metadata"
                          muted
                          playsInline
                          className="h-auto w-full"
                        />
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--chat-glass-surface)] shadow-lg">
                          <Play
                            className="h-5 w-5 translate-x-[1px] text-[var(--chat-text)]"
                            fill="currentColor"
                          />
                        </span>
                      </span>
                    </button>
                  )}

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700 clear-both">
                          Harmful content detected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "voice" && (
                <div className="space-y-2">
                  {message.viewOnce ? (
                    viewOnceVoiceUrl ? (
                      <audio
                        controls
                        autoPlay
                        src={viewOnceVoiceUrl}
                        onEnded={() => setViewOnceVoiceUrl("")}
                        className="max-w-full"
                      />
                    ) : (
                      <button
                        type="button"
                        disabled={isSent || viewOnceOpened || message.viewedByMe}
                        onClick={() => void handleViewOnce("voice")}
                        className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm disabled:opacity-70"
                      >
                        <Eye className="h-4 w-4" />
                        {isSent
                          ? message.viewed
                            ? "Voice note opened"
                            : "Voice note · View once"
                          : viewOnceOpened || message.viewedByMe
                            ? "Voice note opened"
                            : "Listen once"}
                      </button>
                    )
                  ) : (
                    <VoicePlayer src={message.media || ""} duration={message.duration} />
                  )}

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700 clear-both">
                          Harmful content detected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "pdf" && (
                <div className="space-y-2">
                  <div className="flex min-w-[220px] items-center gap-3 rounded-xl bg-black/5 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="flex-1">
                      <p className="truncate text-sm font-medium">
                        {message.fileName || "Document.pdf"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "2.5 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer" aria-label="Download document" className="rounded-full p-2 transition hover:bg-black/10">
                        <Download className="h-4 w-4" />
                    </a>
                  </div>

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700 clear-both">
                          Harmful content detected
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "excel" && (
                <div className="space-y-2">
                  <div className="flex min-w-[220px] items-center gap-3 rounded-xl bg-black/5 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <File className="h-5 w-5" />
                    </div>

                    <div className="flex-1">
                      <p className="truncate text-sm font-medium">
                        {message.fileName || "Spreadsheet.xlsx"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "1.8 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer" aria-label="Download spreadsheet" className="rounded-full p-2 transition hover:bg-black/10">
                        <Download className="h-4 w-4" />
                    </a>
                  </div>

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "file" && (
                <div className="space-y-2">
                  <div className="flex min-w-[220px] items-center gap-3 rounded-xl bg-black/5 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-500 text-white">
                      <Paperclip className="h-5 w-5" />
                    </div>

                    <div className="flex-1">
                      <p className="truncate text-sm font-medium">
                        {message.fileName || "File"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "0 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer" aria-label="Download file" className="rounded-full p-2 transition hover:bg-black/10">
                        <Download className="h-4 w-4" />
                    </a>
                  </div>

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                    </div>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && message.type === "link" && (
                <div className="space-y-2">
                  {isMapLink ? (
                    <div className="min-w-[220px] overflow-hidden rounded-xl bg-black/5">
                      <div className="flex items-center gap-3 border-b border-black/10 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3b82f6] text-white">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <span className="text-xs font-semibold">Location</span>
                      </div>

                      {messageUrl && (
                        <Link
                          href={messageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="flex items-center gap-2 px-3 py-3 text-sm font-medium text-[#075e54] transition hover:underline"
                        >
                          <span className="min-w-0 flex-1 break-all">
                            Open location in Maps
                          </span>
                          <ExternalLink className="h-4 w-4 shrink-0" />
                        </Link>
                      )}
                    </div>
                  ) : (
                    <LinkPreviewCard
                      url={messageUrl}
                      providedTitle={message.linkTitle}
                      providedDescription={message.linkDescription}
                      alwaysShow
                    />
                  )}

                  {message.text && message.text !== messageUrl && (
                    <p className="break-words whitespace-pre-wrap inline">
                      <span>{message.text}</span>
                    </p>
                  )}
                </div>
              )}

              {!message.deletedForEveryone && !isSent && message.buttons && message.buttons.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-black/10 pt-3">
                  {message.buttons.map((button, index) =>
                    button.type === "call" ? (
                      <a
                        key={`${button.type}-${index}`}
                        href={`tel:${button.phoneNumber}`}
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg border border-emerald-700/30 bg-[var(--chat-surface)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-[var(--chat-glass-hover)]"
                      >
                        {button.label}
                      </a>
                    ) : (
                      <button
                        key={`${button.type}-${index}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleTemplateButton(button, index);
                        }}
                        disabled={
                          confirmedButtonIndexes.includes(index) ||
                          pendingButtonIndexes.includes(index)
                        }
                        className="rounded-lg border border-emerald-700/30 bg-[var(--chat-surface)] px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-[var(--chat-glass-hover)]"
                      >
                        {pendingButtonIndexes.includes(index)
                          ? "Sending..."
                          : confirmedButtonIndexes.includes(index)
                            ? "Confirmed"
                            : button.label}
                      </button>
                    ),
                  )}
                </div>
              )}
              {templateButtonError && (
                <p className="mt-2 text-xs text-red-700" role="alert">
                  {templateButtonError}
                </p>
              )}

              {showReactions && (
                <ReactionPicker
                  onReactionSelect={handleReaction}
                  onClose={() => setShowReactions(false)}
                  position="top"
                  align={isSent ? "right" : "left"}
                />
              )}

              <div className="float-right clear-both ml-1 mb-[-2px] mt-1 inline-block select-none">
                <div className="flex h-[15px] items-center justify-end gap-0.5">
                  <span className="text-[11px] font-normal leading-none tracking-tight text-[var(--chat-muted)] opacity-90">
                    {format(new Date(message.timestamp), "h:mm a").toLowerCase()}
                  </span>
                  {isSent && (
                    <span
                      className="ml-0.5 flex items-center"
                      title={messageStatusLabel}
                      aria-label={messageStatusLabel}
                    >
                      {renderStatusIcon()}
                    </span>
                  )}
                </div>
            </div>
            {!message.deletedForEveryone &&
              Object.keys(localReactions).length > 0 && (
                <div
                  className={`mt-1 flex ${
                    isSent ? "justify-end" : "justify-start"
                  }`}
                >
                  <div className="flex flex-wrap gap-1 rounded-2xl border border-[var(--chat-glass-border)] bg-[var(--chat-glass-surface)] px-1.5 py-1 shadow-[0_5px_18px_rgba(15,23,42,0.22)] backdrop-blur-xl">
                    {Object.entries(localReactions).map(([emoji, count]) => (
                      <motion.span
                        key={emoji}
                        whileHover={{ scale: 1.08, y: -1 }}
                        className="inline-flex min-h-7 items-center gap-1 rounded-full border border-[var(--chat-glass-border)] bg-[var(--chat-glass-surface)] px-2 text-[12px] text-[var(--chat-text)] shadow-sm"
                      >
                        <span>{emoji}</span>
                        {count > 1 && (
                          <span className="font-medium text-[var(--chat-muted)]">
                            {count}
                          </span>
                        )}
                      </motion.span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
        </div>
      </div>

      {viewerItem && (
        <MediaViewer item={viewerItem} onClose={() => setViewerItem(null)} />
      )}
    </motion.div>
  )
}

const buttonsSignature = (buttons?: TemplateActionButton[]) =>
  (buttons || []).map((button) => button.type).join("|")

const arePropsEqual = (
  prev: MessageBubbleProps,
  next: MessageBubbleProps,
): boolean =>
  prev.isGroup === next.isGroup &&
  prev.showSenderInfo === next.showSenderInfo &&
  prev.theme === next.theme &&
  prev.user.name === next.user.name &&
  prev.contact.name === next.contact.name &&
  prev.contact.avatar === next.contact.avatar &&
  prev.message.sender === next.message.sender &&
  prev.message.type === next.message.type &&
  prev.message.text === next.message.text &&
  prev.message.media === next.message.media &&
  prev.message.url === next.message.url &&
  prev.message.fileName === next.message.fileName &&
  prev.message.fileSize === next.message.fileSize &&
  prev.message.linkTitle === next.message.linkTitle &&
  prev.message.linkDescription === next.message.linkDescription &&
  prev.message.status === next.message.status &&
  prev.message.deletedForEveryone === next.message.deletedForEveryone &&
  prev.message.viewOnce === next.message.viewOnce &&
  prev.message.viewedByMe === next.message.viewedByMe &&
  prev.message.viewed === next.message.viewed &&
  prev.message.duration === next.message.duration &&
  prev.message.reactions === next.message.reactions &&
  prev.onDeleteMessage === next.onDeleteMessage &&
  prev.onViewOnce === next.onViewOnce &&
  String(prev.message.timestamp) === String(next.message.timestamp) &&
  buttonsSignature(prev.message.buttons) === buttonsSignature(next.message.buttons)

const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)

export default MessageBubble
