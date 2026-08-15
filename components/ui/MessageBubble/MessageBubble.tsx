"use client"

import { motion } from "framer-motion"
import { format } from "date-fns"
import {
  Download,
  Play,
  FileText,
  File,
  Link as LinkIcon,
  Check,
  CheckCheck,
  Forward,
  Paperclip,
  Smile,
} from "lucide-react"
import Image from "next/image"
import React, { useState } from "react"
import ReactionPicker from "@/components/ui/ReactionPicker/ReactionPicker"
import {
  extractLinks,
  validateUrl,
  detectHarmfulWords,
  formatRichText,
} from "@/utils/text/formatting"
import Link from "next/link"

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
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  user,
  contact,
  theme,
  isGroup = false,
  showSenderInfo = false,
  onForward,
}) => {
  const isSent = message.sender === "me"
  const senderName = isSent ? user.name : contact.name
  const [isHovered, setIsHovered] = useState(false)
  const [showReactions, setShowReactions] = useState(false)
  const [localReactions, setLocalReactions] = useState<Record<string, number>>(message.reactions || {})

  const textContent = message.text || ""

  const links = textContent ? extractLinks(textContent) : []
  const topLink = links.find((l) => validateUrl(l))

  const harmful = detectHarmfulWords(textContent)

  const rich = formatRichText(textContent)

  const displaySenderAvatar = !isSent && isGroup && showSenderInfo
  const displaySenderName = !isSent && isGroup && showSenderInfo

  const renderStatusIcon = () => {
    if (message.status === "sending") {
      return <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-500/80" />
    }

    if (message.status === "failed") {
      return <span className="text-[10px] font-medium leading-none text-red-500">Failed</span>
    }

    if (message.status === "seen") {
      return (
        <div className="flex items-center">
          <Check className="h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />
          <Check className="-ml-1.5 h-3.5 w-3.5 text-[#53bdeb]" strokeWidth={2.5} />
        </div>
      )
    }

    if (message.status === "delivered") {
      return (
        <div className="flex items-center">
          <Check className="h-3.5 w-3.5 text-[#667781]" strokeWidth={2.5} />
          <Check className="-ml-1.5 h-3.5 w-3.5 text-[#667781]" strokeWidth={2.5} />
        </div>
      )
    }

    return <Check className="h-3.5 w-3.5 text-[#667781]" strokeWidth={2.5} />
  }

  const handleReaction = (emoji: string) => {
    setLocalReactions((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] ?? 0) + 1,
    }))
    setShowReactions(false)
  }

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
        className={`flex gap-1.5 max-w-[80%] sm:max-w-[70%] md:max-w-[65%] ${
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

        <div className="flex items-end gap-1.5">
          {isHovered && onForward && (
            <button
              onClick={onForward}
              className="mb-1 flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-gray-200/80"
              title="Forward message"
            >
              <Forward className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}

          {isHovered && (
            <button
              onClick={() => setShowReactions((prev) => !prev)}
              className="mb-1 flex-shrink-0 rounded-full p-1.5 transition-colors hover:bg-gray-200/80"
              title="Add reaction"
            >
              <Smile className="h-3.5 w-3.5 text-gray-500" />
            </button>
          )}

          <div className="relative">
            {displaySenderName && (
              <p
                className={`text-[12.8px] font-medium text-[#111b21] mb-1 ml-2`}
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
                  ? "rounded-2xl rounded-tr-md bg-[#d9fdd3] text-[#111b21]"
                  : "rounded-2xl rounded-tl-md bg-white text-[#111b21] shadow-sm"
              } ${
                harmful.hasWarning
                  ? isSent
                    ? "ring-2 ring-red-300"
                    : "border-2 border-red-300"
                  : ""
              } relative leading-[19px]`}
            >
              {message.type === "text" && (
                <div className="break-words whitespace-pre-wrap inline">
                  {topLink && (
                    <div
                      className={`${
                        isSent ? "bg-white/10" : "bg-gray-200"
                      } rounded-lg p-2 mb-2 flex items-center gap-2 clear-both`}
                    >
                      <LinkIcon className="w-4 h-4" />
                      <a
                        href={
                          topLink.startsWith("http")
                            ? topLink
                            : `http://${topLink}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline break-all"
                      >
                        {topLink}
                      </a>
                    </div>
                  )}

                  <span>{rich.nodes}</span>

                  {harmful.hasWarning && (
                    <div className="mt-2 text-xs font-medium text-red-700 clear-both">
                      Harmful content detected: {harmful.warnings.join(", ")}
                    </div>
                  )}
                </div>
              )}

              {message.type === "image" && (
                <div className="space-y-2">
                  {message.media && (
                    <Image
                      src={message.media}
                      alt="Shared Image"
                      width={400}
                      height={300}
                      className="rounded-lg max-w-full h-auto object-cover"
                    />
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

              {message.type === "video" && (
                <div className="space-y-2">
                  {message.media && (
                    <div className="rounded-lg overflow-hidden bg-black">
                      <video src={message.media} controls className="w-full" />
                    </div>
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

              {message.type === "voice" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                      <Play className="w-4 h-4" />
                    </button>

                    <div className="flex-1 h-1 bg-white/20 rounded-full">
                      <div
                        className="h-full bg-white/50 rounded-full"
                        style={{ width: "30%" }}
                      />
                    </div>

                    <span className="text-xs opacity-80">
                      0:{message.duration || "15"}
                    </span>
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

              {message.type === "pdf" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <FileText className="w-8 h-8" />

                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {message.fileName || "Document.pdf"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "2.5 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer">
                      <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                        <Download className="w-4 h-4" />
                      </button>
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

              {message.type === "excel" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <File className="w-8 h-8" />

                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {message.fileName || "Spreadsheet.xlsx"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "1.8 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer">
                      <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                        <Download className="w-4 h-4" />
                      </button>
                    </a>
                  </div>

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                    </div>
                  )}
                </div>
              )}

              {message.type === "file" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 bg-white/10 rounded-lg p-3">
                    <Paperclip className="w-8 h-8" />

                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {message.fileName || "File"}
                      </p>
                      <p className="text-xs opacity-70">
                        {message.fileSize || "0 MB"}
                      </p>
                    </div>

                    <a href={message.media} target="_blank" rel="noopener noreferrer">
                      <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                        <Download className="w-4 h-4" />
                      </button>
                    </a>
                  </div>

                  {message.text && (
                    <div className="break-words whitespace-pre-wrap inline">
                      <span>{formatRichText(message.text).nodes}</span>
                    </div>
                  )}
                </div>
              )}

              {message.type === "link" && (
                <div className="space-y-2">
                  <div className="bg-white/10 rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      <span className="text-xs font-medium">Shared Link</span>
                    </div>

                    {message.url && (
                      <Link
                        href={message.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline break-all"
                      >
                        {message.url}
                      </Link>
                    )}

                    {message.linkTitle && (
                      <p className="text-sm font-medium">{message.linkTitle}</p>
                    )}

                    {message.linkDescription && (
                      <p className="text-xs opacity-70">
                        {message.linkDescription}
                      </p>
                    )}
                  </div>

                  {message.text && (
                    <p className="break-words whitespace-pre-wrap inline">
                      <span>{message.text}</span>
                    </p>
                  )}
                </div>
              )}

              {Object.keys(localReactions).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(localReactions).map(([emoji, count]) => (
                    <motion.span
                      key={emoji}
                      whileHover={{ scale: 1.1 }}
                      className="inline-flex items-center rounded-full border border-[#e5e7eb] bg-white/90 px-1.5 py-0.5 text-[11px] shadow-sm cursor-pointer hover:bg-white"
                    >
                      <span>{emoji}</span>
                      {count > 1 && <span className="ml-0.5 font-medium">{count}</span>}
                    </motion.span>
                  ))}
                </div>
              )}

              {showReactions && (
                <ReactionPicker
                  onReactionSelect={handleReaction}
                  onClose={() => setShowReactions(false)}
                  position="top"
                />
              )}

              <div className="float-right clear-both ml-1 mb-[-2px] mt-1 inline-block select-none">
                <div className="flex h-[15px] items-center justify-end gap-0.5">
                  <span className="text-[11px] font-normal leading-none tracking-tight text-[#667781] opacity-90">
                    {format(new Date(message.timestamp), "h:mm a").toLowerCase()}
                  </span>
                  {isSent && (
                    <span className="ml-0.5 flex items-center">{renderStatusIcon()}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MessageBubble
