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
} from "lucide-react"
import Image from "next/image"
import React from "react"
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
  type: "text" | "image" | "video" | "voice" | "pdf" | "excel" | "link"
  text?: string
  media?: string
  url?: string
  fileName?: string
  fileSize?: string
  linkTitle?: string
  linkDescription?: string
  timestamp: string | Date
  status?: "sent" | "delivered" | "seen"
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
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  user,
  contact,
  theme,
}) => {
  const isSent = message.sender === "me"
  const senderName = isSent ? user.name : contact.name

  const textContent = message.text || ""

  const links = textContent ? extractLinks(textContent) : []
  const topLink = links.find((l) => validateUrl(l))

  const harmful = detectHarmfulWords(textContent)

  const rich = formatRichText(textContent)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isSent ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`flex gap-2 max-w-md ${
          isSent ? "flex-row-reverse" : "flex-row"
        }`}
      >
        {!isSent && (
          <Image
            src={contact.avatar || "/default-avatar.png"}
            alt={contact.name}
            width={32}
            height={32}
            className="w-8 h-8 rounded-full object-cover"
          />
        )}

        <div>
          {!isSent && (
            <p
              className={`text-xs text-gray-600 mb-1 ml-2 ${
                theme.textSize || "text-sm"
              }`}
            >
              {senderName}
            </p>
          )}

          <div
            className={`px-4 py-2 rounded-2xl ${
              isSent
                ? "chat-bubble-sent text-white"
                : "chat-bubble-received bg-gray-100 text-gray-800"
            } ${theme.textSize || "text-sm"} ${
              harmful.hasWarning
                ? isSent
                  ? "ring-2 ring-red-300"
                  : "border-2 border-red-300"
                : ""
            }`}
            style={isSent ? { backgroundColor: theme.primary } : {}}
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

                  <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                    <Download className="w-4 h-4" />
                  </button>
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

                  <button className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition">
                    <Download className="w-4 h-4" />
                  </button>
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
            <div className="flex items-center justify-end gap-2 mt-1">
              <span
                className={`text-xs ${
                  isSent ? "text-white/80" : "text-gray-500"
                }`}
              >
                {format(new Date(message.timestamp), "HH:mm")}
              </span>
              {isSent && (
                <span className="flex items-center">
                  {message.status === "sent" && (
                    <Check className="w-3 h-3 text-white/60" />
                  )}
                  {message.status === "delivered" && (
                    <CheckCheck className="w-3 h-3 text-white/60" />
                  )}
                  {message.status === "seen" && (
                    <CheckCheck className="w-3 h-3 text-blue-400" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default MessageBubble
