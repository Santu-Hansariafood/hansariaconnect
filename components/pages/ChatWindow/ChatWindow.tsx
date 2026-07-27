"use client";

import React from "react";
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  MoreVertical,
  X,
  Trash2,
  Search as SearchIcon,
  Ban,
  CircleUserRound,
  Smile,
  Forward,
} from "lucide-react";
import { format, isSameDay } from "date-fns";
import dynamic from "next/dynamic";
import Picker from "emoji-picker-react";
import { useChatSocket } from "@/hooks/chatwindow/useChatSocket";
import { useSocket } from "@/hooks/useSocket";
import { useUnreadBehavior } from "@/hooks/chatwindow/useUnreadBehavior"
import { useInfiniteScroll } from "@/hooks/chatwindow/useInfiniteScroll"
const MessageBubble = dynamic(() => import("@/components/ui/MessageBubble/MessageBubble"));
const MediaPicker = dynamic(() => import("@/components/ui/MediaPicker/MediaPicker"));
const SearchBar = dynamic(() => import("@/components/common/SearchBar/SearchBar"));
const Loading = dynamic(() => import("@/components/common/Loading/Loading"));
const ForwardModal = dynamic(() => import("@/components/ui/ForwardModal/ForwardModal"));

interface Theme {
  primary: string;
  secondary?: string;
  textSize?: string;
  wallpaper?: string;
}

interface User {
  id: number;
  name: string;
  avatar: string;
}

interface Contact {
  registeredUserId: string;
  name: string;
  avatar: string;
  mobile?: string;
  online?: boolean;
}

interface ChatWindowProps {
  user: User;
  theme: Theme;
  onBack?: () => void;
  id?: string;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ user, theme, onBack, id: propId }) => {
  const router = useRouter();
  const params = useParams();
  const id = propId || (params?.id as string);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [contact, setContact] = useState<any>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  const [savingContact, setSavingContact] = useState(false)
  const [saveError, setSaveError] = useState("")
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [showEditModal, setShowEditModal] = useState(false)
  const [editName, setEditName] = useState("")
  const [editError, setEditError] = useState("")
  const [showForwardModal, setShowForwardModal] = useState(false)
  const [messageToForward, setMessageToForward] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [isGroup, setIsGroup] = useState(false)
  const [groupMembers, setGroupMembers] = useState<any[]>([])

  const handleEmojiClick = (emojiObject: any) => {
    setMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleForwardMessage = (msg: any) => {
    setMessageToForward(msg)
    setShowForwardModal(true)
  }

  const handleForwardSubmit = async (selectedContactIds: string[], text: string) => {
    for (const contactId of selectedContactIds) {
      // Send the message to each selected contact
      const payload = {
        type: messageToForward?.type || "text",
        text: text || messageToForward?.text || "",
        mediaUrl: messageToForward?.mediaUrl || messageToForward?.media || "",
        fileName: messageToForward?.fileName,
        fileSize: messageToForward?.fileSize,
      }

      if (socket) {
        socket.emit("message:send", { to: contactId, ...payload }, () => {})
      } else {
        await fetch(`/api/messages/${contactId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
      }
    }
    setShowForwardModal(false)
    setMessageToForward(null)
  }
  
  const mergeUnique = (prev: any[], incoming: any[]) => {
    const map = new Map<string, any>()
    for (const m of prev) {
      const k = m._id?.toString?.() || m.id?.toString?.() || String(m.createdAt || m.timestamp || "")
      if (!map.has(k)) map.set(k, m)
    }
    for (const m of incoming) {
      const k = m._id?.toString?.() || m.id?.toString?.() || String(m.createdAt || m.timestamp || "")
      if (!map.has(k)) map.set(k, m)
    }
    return Array.from(map.values())
  }

  const { containerRef, hasMore, loadingMore, loadMore, handleScroll } = useInfiniteScroll(id, chatMessages, setChatMessages, mergeUnique)

  const socket = useChatSocket(id, setChatMessages, mergeUnique)

  const { unreadOnOpen, showUnreadBanner, setShowUnreadBanner, unreadDividerRef, hasScrolledToUnreadRef } = useUnreadBehavior(id, chatMessages, socket, setChatMessages)

  useEffect(() => {
    if (unreadOnOpen > 0 && !hasScrolledToUnreadRef.current) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, unreadOnOpen]);

  useEffect(() => {
    const loadAllInitialData = async () => {
      try {
        setInitialLoading(true)
        
        // Try to fetch group first to detect if this is a group chat
        let isGroupChat = false
        try {
          const groupRes = await fetch(`/api/groups/${id}`, { credentials: 'include' })
          if (groupRes.ok) {
            const groupData = await groupRes.json()
            if (groupData?.group) {
              isGroupChat = true
              setIsGroup(true)
              setGroupMembers(groupData.group.members || [])
              setContact({
                name: groupData.group.name || "Group",
                avatar: groupData.group.avatar || "",
                registeredUserId: id,
              })
            }
          }
        } catch {}
        
        // Load all data in parallel for maximum speed
        const [contactsRes, messagesRes, accessRes] = await Promise.all([
          fetch('/api/contacts', { credentials: 'include' }),
          fetch(`/api/messages/${id}?all=true&last=true`, { credentials: 'include' }),
          fetch("/api/access/me", { cache: "no-store" }),
        ])
        
        // Process contacts (only for 1-to-1 chats)
        if (!isGroupChat) {
          try {
            const contactsData = await contactsRes.json()
            if (Array.isArray(contactsData?.contacts)) {
              setContacts(contactsData.contacts)
              const found = contactsData.contacts.find((c: any) => c.registeredUserId === id)
              if (found) setContact(found)
              else {
                // Fallback to fetch user if not in contacts
                const uRes = await fetch(`/api/users/${id}`, { credentials: 'include' })
                const uData = await uRes.json()
                if (uRes.ok && (uData?.mobile || uData?.name || uData?.avatar)) {
                  setContact({ name: uData?.name || uData?.mobile || "User", avatar: uData?.avatar || "", mobile: uData?.mobile || "" })
                }
              }
            }
          } catch {}
        } else {
          // For group chats, still load all contacts for forward modal
          try {
            const contactsData = await contactsRes.json()
            if (Array.isArray(contactsData?.contacts)) {
              setContacts(contactsData.contacts)
            }
          } catch {}
        }
        
        // Process messages
        try {
          const messagesData = await messagesRes.json()
          if (Array.isArray(messagesData?.messages)) setChatMessages(mergeUnique([], messagesData.messages))
        } catch {}
        
        // Process access control
        try {
          const accessData = await accessRes.json()
          if (accessRes.ok && accessData?.permissions) setAllowAttachments(!!accessData.permissions.attachments)
        } catch {}
        
        // Mark as read
        try {
          await fetch('/api/read-receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ peerId: id })
          })
        } catch {}
        
      } catch {} finally {
        setInitialLoading(false)
      }
    }
    loadAllInitialData()
  }, [id])

  const { onlineUserIds, addOnlineListener, removeOnlineListener } = useSocket();
  const isContactOnline = !isGroup && onlineUserIds.includes(id)
  const headerName = contact?.registeredProfile?.name || contact?.name || "User"
  const headerAvatar = contact?.registeredProfile?.photo || contact?.avatar || "/logo/logo.png"
  const [lastSeenText, setLastSeenText] = useState<string>("")

  useEffect(() => {
    if (isGroup) {
      const count = groupMembers.length
      setLastSeenText(count ? `${count} member${count > 1 ? 's' : ''}` : "Group chat")
    } else if (isContactOnline) {
      setLastSeenText("online")
    } else {
      const ls = contact?.lastSeen
      if (ls) {
        try {
          const d = new Date(ls)
          if (!isNaN(d.getTime())) {
            const now = new Date()
            const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000)
            if (diffMin < 1) setLastSeenText("last seen just now")
            else if (diffMin < 60) setLastSeenText(`last seen ${diffMin} minute${diffMin > 1 ? 's' : ''} ago`)
            else if (diffMin < 1440) setLastSeenText(`last seen at ${format(d, "h:mm a")}`)
            else setLastSeenText(`last seen ${format(d, "MMM d, h:mm a")}`)
          } else {
            setLastSeenText("last seen recently")
          }
        } catch {
          setLastSeenText("last seen recently")
        }
      } else {
        setLastSeenText("last seen recently")
      }
    }
  }, [isGroup, groupMembers.length, isContactOnline, contact?.lastSeen])

  const maskedId = (() => {
    const s = String(id || "")
    const last4 = s.slice(-4)
    return `•••• ${last4}`
  })()
  const maskedUrl = (() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const s = String(id || "")
    const last4 = s.slice(-4)
    return `${origin}/chat/${last4}`
  })()

  const isSavedContact = Boolean(contact && (contact._id || contact.id))

  const handleOpenSaveModal = () => {
    setSaveError("")
    setSaveName(headerName || "")
    setShowSaveModal(true)
  }

  const handleSaveContact = async () => {
    if (!saveName.trim()) {
      setSaveError("Name is required")
      return
    }
    const mobile = contact?.mobile || ""
    const cleanMobile = String(mobile).replace(/\D/g, "")
    if (!/^\d{10}$/.test(cleanMobile)) {
      setSaveError("Valid 10-digit mobile required")
      return
    }
    setSavingContact(true)
    setSaveError("")
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: saveName.trim(), mobiles: [cleanMobile] })
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data?.error || 'Failed to save contact')
      } else {
        const newContact = data?.contact
        if (newContact) setContact(newContact)
        setShowSaveModal(false)
      }
    } catch {
      setSaveError('Failed to save contact')
    }
    setSavingContact(false)
  }

  const handleOpenEditModal = () => {
    setEditError("")
    setEditName(headerName || "")
    setShowEditModal(true)
  }

  const handleEditContact = async () => {
    if (!isSavedContact) return
    if (!editName.trim()) {
      setEditError("Name is required")
      return
    }
    try {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: contact._id || contact.id, name: editName.trim() })
      })
      const data = await res.json()
      if (!res.ok) {
        setEditError(data?.error || 'Failed to update contact')
      } else {
        const updated = data?.contact
        if (updated) setContact(updated)
        setShowEditModal(false)
      }
    } catch {
      setEditError('Failed to update contact')
    }
  }

  // Generate temporary ID for optimistic updates
  const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

  const sendViaRest = async (payload: any, tempMessage?: any) => {
    return new Promise<boolean>(async (resolve) => {
      try {
        const res = await fetch(`/api/messages/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (res.ok && data?.message) {
          if (tempMessage) {
            // Replace temporary message with real one
            setChatMessages((prev) =>
              prev.map((m: any) =>
                (m?._id?.toString?.() === tempMessage._id.toString() ? data.message : m
              )
            ))
          } else {
            setChatMessages((prev) => mergeUnique(prev, [data.message]))
          }
          resolve(true)
          return
        }
        if (!res.ok && tempMessage) {
          // Mark temporary message as failed
          setChatMessages((prev) =>
            prev.map((m: any) =>
              (m?._id?.toString?.() === tempMessage._id.toString()
                ? { ...m, status: "failed" }
                : m
            )
          ))
        }
        resolve(false)
      } catch {
        if (tempMessage) {
          setChatMessages((prev) =>
            prev.map((m: any) =>
              (m?._id?.toString?.() === tempMessage._id.toString()
                ? { ...m, status: "failed" }
                : m
            )
          ))
        }
        resolve(false)
      }
    })
  }

  const sendViaSocket = (payload: any, tempMessage?: any) => {
    return new Promise<boolean>((resolve) => {
      if (!socket) return resolve(false)
      try {
        socket.emit("message:send", { to: id, ...payload }, (ack: any) => {
          if (ack?.ok && ack.message) {
            if (tempMessage) {
              // Replace temporary message with real one
              setChatMessages((prev) =>
                prev.map((m: any) =>
                  (m?._id?.toString?.() === tempMessage._id.toString() ? ack.message : m
                )
              ))
            } else {
              setChatMessages((prev) => mergeUnique(prev, [ack.message]))
            }
            resolve(true)
          } else {
            if (tempMessage) {
              setChatMessages((prev) =>
                prev.map((m: any) =>
                  (m?._id?.toString?.() === tempMessage._id.toString()
                    ? { ...m, status: "failed" }
                    : m
                )
              ))
            }
            resolve(false)
          }
        })
      } catch {
        if (tempMessage) {
          setChatMessages((prev) =>
            prev.map((m: any) =>
              (m?._id?.toString?.() === tempMessage._id.toString()
                ? { ...m, status: "failed" }
                : m
            )
          ))
        }
        resolve(false)
      }
    })
  }

  const handleSend = async () => {
    const text = message.trim()
    if (!text) return
    const payload = { type: "text", text }

    // Create optimistic message
    const tempId = generateTempId()
    const optimisticMessage = {
      _id: tempId,
      from: user.id,
      to: id,
      type: payload.type,
      text: payload.text,
      status: "sending",
      createdAt: new Date(),
    }

    setChatMessages((prev) => mergeUnique(prev, [optimisticMessage]))
    setMessage("") // Clear input immediately for better UX

    // Try socket first
    const okSocket = await sendViaSocket(payload, optimisticMessage)
    if (okSocket) {
      return
    }

    // Fallback to REST
    await sendViaRest(payload, optimisticMessage)
  };

  const handleMediaSelect = async (fileOrData: any, type: string) => {
    setShowMediaPicker(false)
    
    // Helper function to send media with optimistic update
    const sendMediaWithOptimistic = async (payload: any) => {
      const tempId = generateTempId()
      const optimisticMessage = {
        _id: tempId,
        from: user.id,
        to: id,
        type: payload.type,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        duration: payload.duration,
        linkTitle: payload.linkTitle,
        linkDescription: payload.linkDescription,
        status: "sending",
        createdAt: new Date(),
      }

      setChatMessages((prev) => mergeUnique(prev, [optimisticMessage]))

      // Try socket first
      if (socket) {
        const okSocket = await sendViaSocket(payload, optimisticMessage)
        if (okSocket) return
      }

      // Fallback to REST
      await sendViaRest(payload, optimisticMessage)
    }

    const uploadFile = async (file: File, fileType: string) => {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("kind", fileType === "image" ? "image" : fileType === "video" ? "video" : "raw")
      try {
        const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" })
        const data = await res.json()
        if (data?.url) {
          const payload = { 
            type: fileType, 
            mediaUrl: data.url, 
            fileName: file.name, 
            fileSize: `${(file.size / (1024*1024)).toFixed(2)} MB` 
          }
          await sendMediaWithOptimistic(payload)
        }
      } catch {}
    }

    if (type === "image" || type === "video") {
      if (fileOrData instanceof File) {
        await uploadFile(fileOrData, type)
      } else {
        const payload = { type, mediaUrl: fileOrData.url }
        await sendMediaWithOptimistic(payload)
      }
    } else if (type === "link") {
      const payload = { type: "link", text: fileOrData.url, mediaUrl: fileOrData.url }
      await sendMediaWithOptimistic(payload)
    } else if (type === "voice") {
      if (fileOrData instanceof File) {
        await uploadFile(fileOrData, type)
      }
    } else if (type === "pdf" || type === "excel" || type === "file") {
      if (fileOrData instanceof File) {
        await uploadFile(fileOrData, type)
      }
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setShowClearConfirm(false);
    setShowOptionsMenu(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim()) {
      const results = chatMessages.filter(
        (msg) => msg.text && msg.text.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleBlockToggle = () => {
    setIsBlocked((prev) => !prev);
    setShowOptionsMenu(false);
  };

  if (initialLoading) {
    return (
      <div className={`min-h-screen ${theme.wallpaper || ''}`}>
        <Loading />
      </div>
    )
  }

  return (
    <div className="h-screen w-screen sm:h-full sm:w-full max-w-full flex flex-col bg-[#efeae2] min-w-0 overflow-hidden">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#f0f2f5] border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-sm"
      >
        <button
            onClick={onBack || (() => router.push("/"))}
            className="p-2 hover:bg-gray-200/70 rounded-full transition-all duration-200"
          >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative flex-shrink-0">
              <Image
                src={headerAvatar || "/logo/logo.png"}
                alt={headerName}
                width={40}
                height={40}
                className="w-10 h-10 rounded-full object-cover"
              />

              {isContactOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#f0f2f5] rounded-full" />
              )}
            </div>
          <div className="flex flex-col min-w-0">
            <h2 className={`font-semibold text-gray-800 text-[15px] truncate ${theme.textSize}`}>
              {headerName}
            </h2>
            <span className={`text-[12px] truncate ${
              !isGroup && isContactOnline ? "text-green-600" : "text-gray-500"
            }`}>
              {lastSeenText}
            </span>
          </div>
          {showUnreadBanner && unreadOnOpen > 0 && (
            <span className="text-[11px] px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full ml-2 flex-shrink-0">
              {unreadOnOpen} unread
            </span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            className="p-2 hover:bg-gray-200/70 rounded-full transition-all duration-200"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {showOptionsMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
            >
              <div
                className="px-4 py-3"
                style={{
                  background: `linear-gradient(
                                                to right,
                                                ${theme.primary},
                                                ${theme.primary}AA,
                                                ${theme.primary}66,
                                                ${theme.secondary ?? theme.primary}
                                              )`,
                        }}
              >
                <p className="text-white font-semibold text-sm">{headerName}</p>
                <p className="text-white/80 text-xs">{`Chat URL: ${maskedUrl}`}</p>
              </div>

              <div className="py-2">
                {!isSavedContact && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      handleOpenSaveModal();
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <CircleUserRound className="w-5 h-5 text-emerald-600" />
                    <span className="text-gray-700 font-medium">Save Contact</span>
                  </button>
                )}
                {isSavedContact && (
                  <button
                    onClick={() => {
                      setShowOptionsMenu(false);
                      handleOpenEditModal();
                    }}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <CircleUserRound className="w-5 h-5 text-blue-600" />
                    <span className="text-gray-700 font-medium">Edit Contact Name</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowClearConfirm(true);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <span className="text-gray-700 font-medium">Clear Chat</span>
                </button>

                <button
                  onClick={() => {
                    setShowSearch(true);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <SearchIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700 font-medium">Search</span>
                </button>

                <button
                  onClick={handleBlockToggle}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Ban className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700 font-medium">
                    {isBlocked ? "Unmute" : "Block/Mute"}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.header>
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Save Contact</h3>
            {saveError && <div className="text-red-600 text-sm mb-2">{saveError}</div>}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input value={saveName} onChange={(e) => setSaveName(e.target.value)} className="w-full px-4 py-3 border rounded-xl" placeholder="Enter name" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSaveModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700">Cancel</button>
              <button onClick={handleSaveContact} disabled={savingContact} className="px-4 py-2 rounded-xl text-white" style={{ backgroundColor: theme.primary }}>{savingContact ? 'Saving...' : 'Save'}</button>
            </div>
          </motion.div>
        </div>
      )}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Edit Contact Name</h3>
            {editError && <div className="text-red-600 text-sm mb-2">{editError}</div>}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full px-4 py-3 border rounded-xl" placeholder="Enter name" />
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700">Cancel</button>
              <button onClick={handleEditContact} className="px-4 py-2 rounded-xl text-white" style={{ backgroundColor: theme.primary }}>Update</button>
            </div>
          </motion.div>
        </div>
      )}
      {showSearch && (
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <SearchBar onSearch={handleSearch} placeholder="Search messages..." />
            <button
              onClick={() => {
                setShowSearch(false)
                setSearchQuery("")
                setSearchResults([])
              }}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      )}
      <div 
        ref={containerRef} 
        onScroll={handleScroll} 
        className={`flex-1 overflow-y-auto min-w-0 min-h-0 px-[4%] sm:px-[8%] py-3 sm:py-4 ${
          theme.wallpaper || "bg-[#efeae2]"
        }`}
        style={
          !theme.wallpaper
            ? {
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='%23d4cfc4' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
              }
            : undefined
        }
      >
        <div className="max-w-4xl mx-auto space-y-1.5 w-full min-w-0">
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-600 py-6">
              <p className="text-sm">{isGroup ? `No messages in ${headerName}. Start the conversation!` : `New chat with ${contact?.name || "user"}. Start typing or send media.`}</p>
            </div>
          )}
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-3 py-2 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200"
              >
                {loadingMore ? "Loading..." : "Load older messages"}
              </button>
            </div>
          )}
          {showUnreadBanner && unreadOnOpen > 0 && (
            <div className="sticky top-0 z-10">
              <div className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-xl text-sm font-medium shadow">
                {unreadOnOpen} unread message{unreadOnOpen > 1 ? 's' : ''}
              </div>
            </div>
          )}
          {(showSearch && searchQuery.trim() ? searchResults : chatMessages).map((msg: any, idx: number, arr: any[]) => {
            const fromStr = ((typeof msg.from === 'string' ? msg.from : (msg.from?.toString?.() || msg.from?.$oid || ''))) as string
            const isIncoming = fromStr === id
            const notSeen = (msg.status || 'sent') !== 'seen'
            const firstUnread = (() => {
              for (let i = 0; i < arr.length; i++) {
                const m = arr[i]
                const f = ((typeof m.from === 'string' ? m.from : (m.from?.toString?.() || m.from?.$oid || ''))) as string
                if (f === id && (m.status || 'sent') !== 'seen') return i
              }
              return -1
            })()
            
            // Check if we need a date divider
            const currentDate = new Date(msg.timestamp || msg.createdAt || Date.now())
            const prevMsg = idx > 0 ? arr[idx - 1] : null
            const prevDate = prevMsg ? new Date(prevMsg.timestamp || prevMsg.createdAt || Date.now()) : null
            const showDateDivider = !prevDate || !isSameDay(currentDate, prevDate)

            return (
              <React.Fragment key={(msg._id?.toString?.()) || `${msg.from}-${msg.to}-${msg.createdAt || msg.timestamp}-${msg.mediaUrl || msg.text || ''}`}>
                {showDateDivider && (
                  <div className="flex justify-center my-4">
                    <span className="text-xs px-4 py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
                      {format(currentDate, "MMMM d, yyyy")}
                    </span>
                  </div>
                )}
                {idx === firstUnread && firstUnread >= 0 && (
                  <div className="flex justify-center my-2" ref={unreadDividerRef}>
                    <span className="text-xs px-3 py-1 bg-yellow-200 rounded-full text-yellow-800 font-medium">Unread messages</span>
                  </div>
                )}
                <MessageBubble
              message={{
                sender: isIncoming ? "contact" : "me",
                type: msg.type,
                text: msg.text,
                media: msg.mediaUrl,
                url: msg.mediaUrl || undefined,
                timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
                status: msg.status || "sent",
              } as any}
              user={user}
              contact={(() => {
                if (isGroup && isIncoming) {
                  const senderId = (typeof msg.from === 'string' ? msg.from : (msg.from?.toString?.() || msg.from?.$oid || '')) as string
                  const member = groupMembers.find((m: any) => String(m.id) === String(senderId))
                  if (member) {
                    return { id: member.id, name: member.name, avatar: member.avatar } as any
                  }
                }
                return { id, name: headerName, avatar: headerAvatar } as any
              })()}
              theme={theme}
              isGroup={isGroup}
              onForward={() => handleForwardMessage(msg)}
            />
              </React.Fragment>
            )
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#f0f2f5] border-t border-gray-200 px-2 sm:px-4 py-2 sm:py-2.5 relative min-w-0 w-full"
      >
        <div className="max-w-4xl mx-auto flex items-center gap-1 sm:gap-2 min-w-0">
          <button
            onClick={() => allowAttachments && setShowMediaPicker((prev) => !prev)}
            disabled={!allowAttachments}
            className="p-2.5 hover:bg-gray-200/70 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Attach"
          >
            <ImageIcon className="w-5 h-5 text-gray-500" />
          </button>

          <button
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            className="p-2.5 hover:bg-gray-200/70 rounded-full transition-all duration-200"
            title="Emoji"
          >
            <Smile className="w-5 h-5 text-gray-500" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className={`flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white rounded-full focus:outline-none focus:ring-0 border border-transparent hover:border-gray-200 text-[14px] sm:text-[15px] ${theme.textSize}`}
          />

          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={handleSend}
            className="p-2 sm:p-2.5 rounded-full text-white shadow-sm flex-shrink-0"
            style={{ backgroundColor: "#00a884" }}
            title="Send"
          >
            <Send className="w-4 h-4 sm:w-5 sm:h-5" />
          </motion.button>
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-full left-4 mb-2 z-50">
            <Picker onEmojiClick={handleEmojiClick} />
          </div>
        )}

        {showMediaPicker && allowAttachments && (
            <MediaPicker
              onSelect={handleMediaSelect}
              onClose={() => setShowMediaPicker(false)}
            />
          )}
        {showForwardModal && (
            <ForwardModal
              contacts={contacts.map((c: any) => ({
                id: c.registeredUserId,
                name: c.name,
                mobile: c.mobile || "",
                avatar: c.registeredProfile?.photo || c.avatar || "/logo/logo.png",
              }))}
              theme={theme}
              onClose={() => {
                setShowForwardModal(false);
                setMessageToForward(null);
              }}
              onForward={handleForwardSubmit}
            />
          )}
      </motion.div>
    </div>
  );
};

export default ChatWindow;
