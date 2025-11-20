"use client"

import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { Pin } from "lucide-react"
import { useState, useRef, useEffect, TouchEvent, MouseEvent } from "react"
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
  theme: Theme
  showContextMenu?: boolean
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onClick,
  onPin,
  onUnpin,
  onForward,
  theme,
  showContextMenu = true,
}) => {
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 })
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
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

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (!showContextMenu || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setContextMenu({
      visible: true,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (!showContextMenu || !cardRef.current) return
    const timer = setTimeout(() => {
      const touch = e.touches[0]
      const rect = cardRef.current.getBoundingClientRect()
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
      whileHover={{ scale: 1.02, x: 4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="bg-white rounded-2xl p-4 shadow-md hover:shadow-lg transition-all cursor-pointer relative"
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Image
            src={contact.avatar}
            alt={contact.name}
            width={56}
            height={56}
            className="rounded-full object-cover"
          />
          {contact.active && (
            <span
              className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"
              title="Active"
            ></span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {contact.pinned && <Pin className="w-4 h-4 text-gray-600" fill="currentColor" />}
              <h3 className={`font-semibold text-gray-800 truncate ${theme.textSize ?? "text-base"}`}>
                {contact.name}
              </h3>
            </div>
            <span className="text-xs text-gray-500">
              {(() => {
                const d = new Date(contact.lastMessageTime)
                return isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true })
              })()}
            </span>
          </div>
          <p className="text-sm text-gray-600 truncate">{contact.lastMessage}</p>
        </div>
        {contact.unread > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: theme.primary }}
          >
            {contact.unread}
          </motion.div>
        )}
      </div>
      <div className="mt-1">
        <span className={`text-xs px-2 py-1 rounded-full ${contact.registered ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
          {contact.registered ? "Registered" : "Not Registered"}
        </span>
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
        </motion.div>
      )}
    </motion.div>
  )
}

export default ContactCard
