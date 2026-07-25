"use client"

import { motion } from "framer-motion"
import { formatDistanceToNow, format } from "date-fns"
import { Pin, Pencil, Trash2 } from "lucide-react"
import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"

interface Contact {
  id: string
  name: string
  avatar: string
  active: boolean
  pinned: boolean
  unread: number
  lastMessage: string
  lastMessageTime: string | Date
  registered?: boolean
}

interface Theme {
  primary: string
  textSize?: string
}

interface ContactCardProps {
  contact: Contact
  onClick: () => void
  onPin: (id: string) => void
  onUnpin: (id: string) => void
  onForward: (contact: Contact) => void
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  theme: Theme
  showContextMenu?: boolean
  active?: boolean
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  onPin,
  onUnpin,
  onForward,
  onEdit,
  onDelete,
  theme,
  showContextMenu = true,
  active = false,
}) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (cardRef.current && !(event.target as Node)?.isSameNode(cardRef.current) && !cardRef.current.contains(event.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 })
      }
    }

    if (contextMenu.visible) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("touchstart", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("touchstart", handleClickOutside)
    }
  }, [contextMenu.visible])

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!showContextMenu || !cardRef.current) return
    const el = cardRef.current as HTMLDivElement
    const rect = el.getBoundingClientRect()
    setContextMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!showContextMenu || !cardRef.current) return
    const timer = setTimeout(() => {
      const touch = e.touches[0]
      const el = cardRef.current as HTMLDivElement
      const rect = el.getBoundingClientRect()
      setContextMenu({
        visible: true,
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      })
    }, 500)
    setLongPressTimer(timer)
  }

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
  }

  const handlePinToggle = () => {
    if (contact.pinned) onUnpin(contact.id)
    else onPin(contact.id)
    setContextMenu({ visible: false, x: 0, y: 0 })
  }

  const handleForwardClick = () => {
    onForward(contact)
    setContextMenu({ visible: false, x: 0, y: 0 })
  }

  return (
    <motion.div
      ref={cardRef}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`px-4 py-3 cursor-pointer relative transition-colors ${
        active
          ? "bg-gray-100"
          : "hover:bg-[#f5f6f6]"
      } border-b border-gray-100`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <Image
            src={contact.avatar}
            alt={contact.name}
            width={49}
            height={49}
            className="w-[49px] h-[49px] rounded-full object-cover"
          />
          {contact.active && (
            <span
              className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"
              title="Online"
            ></span>
          )}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {contact.pinned && <Pin className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" fill="currentColor" />}
              <h3 className={`font-semibold text-gray-900 truncate text-[16px] ${theme.textSize ?? ""}`}>
                {contact.name}
              </h3>
            </div>
            <span className={`text-[12px] flex-shrink-0 ml-2 ${
              contact.unread > 0 ? "text-[#00a884] font-medium" : "text-gray-500"
            }`}>
              {(() => {
                const d = new Date(contact.lastMessageTime)
                if (isNaN(d.getTime())) return ""
                const today = new Date()
                if (d.toDateString() === today.toDateString()) {
                  return format(d, "h:mm a")
                }
                const yesterday = new Date(today)
                yesterday.setDate(yesterday.getDate() - 1)
                if (d.toDateString() === yesterday.toDateString()) {
                  return "Yesterday"
                }
                return format(d, "MM/dd/yyyy")
              })()}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-gray-500 truncate text-[14px] leading-5">
              {contact.lastMessage}
            </p>
            {contact.unread > 0 && (
              <span
                className="flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
                style={{ backgroundColor: "#00a884" }}
              >
                {contact.unread > 99 ? "99+" : contact.unread}
              </span>
            )}
          </div>
        </div>
      </div>

      {contextMenu.visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute z-50 bg-white rounded-xl shadow-2xl py-2 min-w-[180px]"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            transform: "translate(-50%, 0)",
          }}
        >
          <button
            onClick={handlePinToggle}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
          >
            <Pin className="w-4 h-4" />
            <span>{contact.pinned ? "Unpin Chat" : "Pin Chat"}</span>
          </button>
          <button
            onClick={handleForwardClick}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
            <span>Forward Message</span>
          </button>
          <button
            onClick={() => { onEdit(contact); setContextMenu({ visible: false, x: 0, y: 0 }) }}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
          >
            <Pencil className="w-4 h-4" />
            <span>Edit Contact</span>
          </button>
          <button
            onClick={() => { onDelete(contact.id); setContextMenu({ visible: false, x: 0, y: 0 }) }}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-3 text-red-600"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Contact</span>
          </button>
        </motion.div>
      )}
    </motion.div>
  )
}

export default ContactCard
