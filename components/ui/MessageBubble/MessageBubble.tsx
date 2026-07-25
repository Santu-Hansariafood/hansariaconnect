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
} from "lucide-react"
import Image from "next/image"
import React, { useState } from "react"
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
  onForward?: () => void
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  user,
  contact,
  theme,
  onForward,
}) => {
  const isSent = message.sender === "me"
  const senderName = isSent ? user.name : contact.name
  const [isHovered, setIsHovered] = useState(false)

  const textContent = message.text || ""

  const links = textContent ? extractLinks(textContent) : []
  const topLink = links.find((l) => validateUrl(l))

  const harmful = detectHarmfulWords(textContent)

  const rich = formatRichText(textContent)

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
        className={`flex gap-1.5 max-w-[65%] ${
          isSent ? "flex-row-reverse" : "flex-row"
        } items-end`}
      >
        {!isSent && (
          <Image
            src={contact.avatar || "/logo/logo.png"}
            alt={contact.name}
            width={28}
            height={28}
            className="w-7 h-7 rounded-full object-cover flex-shrink-0 mb-1"
          />
        )}

        <div className="flex items-end gap-1.5">
          {isHovered && onForward && (
            <button
              onClick={onForward}
              className="p-1.5 hover:bg-gray-200/80 rounded-full transition-colors mb-1 flex-shrink-0"
              title="Forward message"
            >
              <Forward className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}

          <div>
            {!isSent && (
              <p
                className={`text-[12.8px] font-medium text-[#111b21] mb-1 ml-2`}
              >
                {senderName}
              </p>
            )}

            <div
              className={`px-2.5 pb-1.5 pt-1.5 ${
                theme.textSize || "text-[14.2px]"
              } ${
                isSent
                  ? "bg-[#d9fdd3] text-[#111b21] rounded-tr-none rounded-2xl"
                  : "bg-white text-[#111b21] rounded-tl-none rounded-2xl shadow-sm"
              } ${
                harmful.hasWarning
                  ? isSent
                    ? "ring-2 ring-red-300"
                    : "border-2 border-red-300"
                  : ""
              } relative leading-[19px]`}
            >
              {message.type === "text" && (
                <div className="break-words">
                  {topLink && (
                    <div
                      className={`${
                        isSent ? "bg-white/10" : "bg-gray-200"
                      } rounded-lg p-2 mb-2 flex items-center gap-2`}
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

                  <div>{rich.nodes}</div>

                  {harmful.hasWarning && (
                    <div className="mt-2 text-xs font-medium text-red-700">
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700">
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700">
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700">
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
                      {harmful.hasWarning && (
                        <div className="mt-2 text-xs text-red-700">
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
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
                    <div className="break-words">
                      {formatRichText(message.text).nodes}
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
                    <p className="break-words">{message.text}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-1 mt-0.5 mb-0.5 mr-1 float-right clear-both" style={{ marginTop: "-2px" }}>
                <span
                  className={`text-[11px] ${
                    isSent ? "text-[#667781]" : "text-[#667781]"
                  }`}
                >
                  {format(new Date(message.timestamp), "h:mm a")}
                </span>
                {isSent && (
                  <span className="flex items-center ml-0.5">
                    {message.status === "sending" && (
                      <div className="w-3 h-3 border-2 border-gray-400/40 border-t-gray-500/80 rounded-full animate-spin" />
                    )}
                    {message.status === "failed" && (
                      <span className="text-red-500 text-[10px] font-medium">Failed</span>
                    )}
                    {message.status === "sent" && (
                      <Check className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} />
                    )}
                    {message.status === "delivered" && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} />
                    )}
                    {message.status === "seen" && (
                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" strokeWidth={2.5} fill="#53bdeb" fillOpacity={0.15} />
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MessageBubble
