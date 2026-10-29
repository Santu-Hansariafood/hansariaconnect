"use client"

import { Pin, Pencil, Trash2, Forward, Archive, ArchiveRestore } from "lucide-react"
import React, { useState, useRef, useEffect } from "react"
import Image from "next/image"
import { formatChatListTime } from "@/utils/time/chatTime"

interface Contact {
  id: string
  name: string
  mobile: string
  avatar: string
  active: boolean
  pinned: boolean
  unread: number
  lastMessage: string
  lastMessageTime: string
  registered?: boolean
  archived?: boolean
}

interface Theme {
  primary: string
  textSize?: string
}

export interface RowTone {
  /** Brand color used for the active indicator and the unread badge. */
  accent: string
  /** Primary text (contact name, unread preview). */
  text: string
  /** Secondary text (read preview, timestamp). */
  muted: string
  /** Row background for the selected chat. */
  active: string
  /** Row background on hover. */
  hover: string
  /** Hairline divider between rows. */
  border: string
  /** Row surface color, used to ring the online dot. */
  surface: string
}

interface ContactCardProps {
  contact: Contact
  onSelect: (contact: Contact) => void
  onPin: (id: string) => void
  onUnpin: (id: string) => void
  onForward: (contact: Contact) => void
  onEdit: (contact: Contact) => void
  onDelete: (id: string) => void
  onArchive: (contact: Contact) => void
  theme: Theme
  tone: RowTone
  showContextMenu?: boolean
  active?: boolean
}

const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onSelect,
  onPin,
  onUnpin,
  onForward,
  onEdit,
  onDelete,
  onArchive,
  theme,
  tone,
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
    <div
      ref={cardRef}
      onClick={() => onSelect(contact)}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`relative cursor-pointer px-4 py-3 transition-colors duration-150 active:scale-[0.995] ${
        active ? tone.active : tone.hover
      } border-b ${tone.border}`}
    >
      {active && (
        <span
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: tone.accent }}
        />
      )}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <Image
            src={contact.avatar}
            alt={contact.name}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover"
          />
          {contact.active && (
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 bg-green-500 ${tone.surface}`}
              title="Online"
            ></span>
          )}
        </div>
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center justify-between mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {contact.pinned && (
                <Pin
                  className={`w-3.5 h-3.5 flex-shrink-0 ${tone.muted}`}
                  fill="currentColor"
                />
              )}
              <h3 className={`truncate text-[16px] font-semibold ${tone.text} ${theme.textSize ?? ""}`}>
                {contact.name}
              </h3>
            </div>
            <span
              className={`ml-2 flex-shrink-0 text-[12px] ${
                contact.unread > 0 ? "font-medium" : tone.muted
              }`}
              style={contact.unread > 0 ? { color: tone.accent } : undefined}
            >
              {formatChatListTime(contact.lastMessageTime)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className={`truncate text-[14px] leading-5 ${
              contact.unread > 0 ? `font-medium ${tone.text}` : tone.muted
            }`}>
              {contact.lastMessage}
            </p>
            {contact.unread > 0 && (
              <span
                className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: tone.accent }}
              >
                {contact.unread > 99 ? "99+" : contact.unread}
              </span>
            )}
          </div>
        </div>
      </div>

      {contextMenu.visible && (
        <div
          className="absolute z-50 bg-white rounded-xl shadow-2xl py-2 min-w-[180px]"
          style={{
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            transform: "translate(-50%, 0)",
          }}
        >
          <button
            onClick={() => {
              onArchive(contact)
              setContextMenu({ visible: false, x: 0, y: 0 })
            }}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors flex items-center gap-3 text-gray-700"
          >
            {contact.archived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            <span>{contact.archived ? "Unarchive Chat" : "Archive Chat"}</span>
          </button>
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
            <Forward className="w-4 h-4" />
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
        </div>
      )}
    </div>
  )
}

// Memoize ContactCard to prevent unnecessary re-renders when parent updates
export default React.memo(ContactCard, (prevProps, nextProps) => {
  // Return true if props are equal (don't re-render), false if different (do re-render)
  const pc = prevProps.contact;
  const nc = nextProps.contact;
  return (
    pc.id === nc.id &&
    pc.name === nc.name &&
    pc.avatar === nc.avatar &&
    pc.unread === nc.unread &&
    pc.active === nc.active &&
    pc.pinned === nc.pinned &&
    pc.lastMessage === nc.lastMessage &&
    pc.lastMessageTime === nc.lastMessageTime &&
    prevProps.active === nextProps.active
  );
})
