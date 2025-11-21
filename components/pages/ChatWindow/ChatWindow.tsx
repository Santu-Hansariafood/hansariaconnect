"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import io from "socket.io-client"
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  MoreVertical,
  X,
  Trash2,
  Search as SearchIcon,
  Ban,
} from "lucide-react";
import dynamic from "next/dynamic";
const MessageBubble = dynamic(() => import("@/components/ui/MessageBubble/MessageBubble"));
const MediaPicker = dynamic(() => import("@/components/ui/MediaPicker/MediaPicker"));
import SearchBar from "@/components/common/SearchBar/SearchBar";

interface Theme {
  primary: string;
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
}

const ChatWindow: React.FC<ChatWindowProps> = ({ user, theme }) => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [socket, setSocket] = useState<any>(null)
  const [contact, setContact] = useState<any>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const preloadRef = useRef(false)
  const mergeUnique = (prev: any[], incoming: any[]) => {
    const map = new Map<string, any>()
    for (const m of prev) {
      const k = m.id?.toString?.() || m._id?.toString?.() || String(m.timestamp || m.createdAt || "")
      if (!map.has(k)) map.set(k, m)
    }
    for (const m of incoming) {
      const k = m.id?.toString?.() || m._id?.toString?.() || String(m.timestamp || m.createdAt || "")
      if (!map.has(k)) map.set(k, m)
    }
    return Array.from(map.values()).sort((a: any, b: any) => {
      const ta = new Date(a.timestamp || a.createdAt || 0).getTime()
      const tb = new Date(b.timestamp || b.createdAt || 0).getTime()
      return ta - tb
    })
  }
  useEffect(() => {
    const loadContact = async () => {
      try {
        const res = await fetch('/api/contacts')
        const data = await res.json()
        if (Array.isArray(data?.contacts)) {
          const found = data.contacts.find((c: any) => c.registeredUserId === id)
          if (found) setContact(found)
          else {
            try {
              const uRes = await fetch(`/api/users/${id}`)
              const uData = await uRes.json()
              if (uRes.ok && uData?.mobile) {
                setContact({ name: uData.mobile, avatar: "", mobile: uData.mobile })
              }
            } catch {}
          }
        }
      } catch {}
    }
    loadContact()
  }, [id])

  useEffect(() => {
    if (loadingMoreRef.current) return
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    let s: any
    const connect = async () => {
      try { await fetch('/api/socket') } catch {}
      s = io({ path: "/api/socket", transports: ["websocket", "polling"], withCredentials: true })
      setSocket(s)
      s.on("message:new", (msg: any) => {
        if (msg?.from?.toString?.() === id) {
          setChatMessages((prev) => mergeUnique(prev, [msg]))
          try {
            s.emit("message:status", { id: msg?._id?.toString?.(), status: "delivered" }, (ack: any) => {
              if (ack?.ok && ack?.message?._id) {
                const mid = ack.message._id?.toString?.()
                if (mid) updateMessageStatus(mid, ack.message.status)
              }
            })
            setTimeout(() => {
              s.emit("message:status", { id: msg?._id?.toString?.(), status: "seen" }, (ack: any) => {
                if (ack?.ok && ack?.message?._id) {
                  const mid = ack.message._id?.toString?.()
                  if (mid) updateMessageStatus(mid, ack.message.status)
                }
              })
            }, 500)
          } catch {}
        }
      })
    }
    connect()
    return () => {
      if (s) s.disconnect()
    }
  }, [id])

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/messages/${id}?all=true&last=true`, { credentials: 'include' })
        const data = await res.json()
        if (Array.isArray(data?.messages)) setChatMessages(mergeUnique([], data.messages))
        setHasMore(!!data?.hasMore)
      } catch {}
    }
    load()
  }, [id])

  useEffect(() => {
    const run = async () => {
      if (preloadRef.current) return
      if (!hasMore) return
      if (chatMessages.length >= 40) return
      preloadRef.current = true
      for (let i = 0; i < 3; i++) {
        if (!hasMore) break
        await loadMore()
        await new Promise((r) => setTimeout(r, 200))
      }
      preloadRef.current = false
    }
    run()
  }, [hasMore, chatMessages.length, id])

  const loadMore = async () => {
    if (!chatMessages.length) return
    const el = containerRef.current
    const prevHeight = el?.scrollHeight || 0
    const prevTop = el?.scrollTop || 0
    setLoadingMore(true)
    loadingMoreRef.current = true
    try {
      const oldest = chatMessages[0]
      const tsRaw = oldest.timestamp || oldest.createdAt
      const ts = typeof tsRaw === "string" ? tsRaw : new Date(tsRaw).toISOString()
      const res = await fetch(`/api/messages/${id}?limit=10&before=${encodeURIComponent(ts)}`, { credentials: 'include' })
      const data = await res.json()
      if (Array.isArray(data?.messages) && data.messages.length) {
        setChatMessages((prev) => mergeUnique(prev, data.messages))
        setHasMore(!!data?.hasMore)
        setTimeout(() => {
          const el2 = containerRef.current
          if (el2) {
            const newHeight = el2.scrollHeight || 0
            const delta = newHeight - prevHeight
            el2.scrollTop = prevTop + delta
          }
        }, 0)
      } else {
        setHasMore(false)
      }
    } catch {}
    setLoadingMore(false)
    loadingMoreRef.current = false
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMore) return
    if (!hasMore) return
    const target = e.currentTarget
    if (target.scrollTop <= 10) {
      loadMore()
    }
  }

  const headerName = contact?.name || "User"
  const headerAvatar = contact?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"

  const sendViaRest = async (payload: any) => {
    try {
      const res = await fetch(`/api/messages/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok && data?.message) {
        setChatMessages((prev) => mergeUnique(prev, [data.message]))
        return true
      }
      if (!res.ok) {
        const err = data?.error || "Send failed"
        setShowMediaPicker(false)
      }
    } catch {}
    return false
  }

  const updateMessageStatus = (mid: string, status: string) => {
    setChatMessages((prev) => prev.map((m: any) => {
      const idStr = m?._id?.toString?.()
      if (idStr && idStr === mid) return { ...m, status }
      return m
    }))
  }

  const sendViaSocket = (payload: any) => {
    return new Promise<boolean>((resolve) => {
      if (!socket) return resolve(false)
      try {
        socket.emit("message:send", { to: id, ...payload }, (ack: any) => {
          if (ack?.ok && ack.message) {
            setChatMessages((prev) => mergeUnique(prev, [ack.message]))
            resolve(true)
          } else {
            resolve(false)
          }
        })
      } catch {
        resolve(false)
      }
    })
  }

  const handleSend = async () => {
    const text = message.trim()
    if (!text) return
    const payload = { type: "text", text }
    const okSocket = await sendViaSocket(payload)
    if (okSocket) {
      setMessage("")
      return
    }
    const okRest = await sendViaRest(payload)
    if (okRest) setMessage("")
  };

  const handleMediaSelect = async (fileOrData: any, type: string) => {
    setShowMediaPicker(false)
    if (!socket) return
    if (type === "image" || type === "video") {
      if (fileOrData instanceof File) {
        const fd = new FormData()
        fd.append("file", fileOrData)
        fd.append("kind", type === "video" ? "video" : "image")
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd })
          const data = await res.json()
          if (data?.url) {
            const payload = { type: "image", mediaUrl: data.url }
            const okSocket = await sendViaSocket(payload)
            if (!okSocket) await sendViaRest(payload)
          }
        } catch {}
      } else {
        const payload = { type, mediaUrl: fileOrData.url }
        const okSocket = await sendViaSocket(payload)
        if (!okSocket) await sendViaRest(payload)
      }
    } else if (type === "link") {
      const payload = { type: "link", text: fileOrData.url, mediaUrl: fileOrData.url }
      const okSocket = await sendViaSocket(payload)
      if (!okSocket) await sendViaRest(payload)
    } else if (type === "voice") {
      if (fileOrData instanceof File) {
        const fd = new FormData()
        fd.append("file", fileOrData)
        fd.append("kind", "video")
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd })
          const data = await res.json()
          if (data?.url) {
            const payload = { type: "voice", mediaUrl: data.url }
            const okSocket = await sendViaSocket(payload)
            if (!okSocket) await sendViaRest(payload)
          }
        } catch {}
      }
    } else if (type === "pdf" || type === "excel") {
      if (fileOrData instanceof File) {
        const fd = new FormData()
        fd.append("file", fileOrData)
        fd.append("kind", "raw")
        try {
          const res = await fetch("/api/upload", { method: "POST", body: fd })
          const data = await res.json()
          if (data?.url) {
            const payload = { type, mediaUrl: data.url, fileName: fileOrData.name, fileSize: `${(fileOrData.size / (1024*1024)).toFixed(2)} MB` }
            const okSocket = await sendViaSocket(payload)
            if (!okSocket) await sendViaRest(payload)
          }
        } catch {}
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm"
        style={{ backgroundColor: `${theme.primary}10` }}
      >
        <button
          onClick={() => router.push("/")}
          className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
        >
          <ArrowLeft className="w-6 h-6" style={{ color: theme.primary }} />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <img
              src={headerAvatar}
              alt={headerName}
              className="w-10 h-10 rounded-full object-cover"
            />
            {contact?.online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <h2 className={`font-semibold text-gray-800 ${theme.textSize}`}>
            {headerName}
          </h2>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
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
                  background: `linear-gradient(to right, ${theme.primary}, ${theme.primary}AA, ${theme.primary}66, ${theme.secondary})`,
                }}
              >
                <p className="text-white font-semibold text-sm">{headerName}</p>
                <p className="text-white/80 text-xs">{`ID: ${id}`}</p>
              </div>

              <div className="py-2">
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
      <div ref={containerRef} onScroll={handleScroll} className={`flex-1 overflow-y-auto p-4 ${theme.wallpaper}`}>
        <div className="max-w-4xl mx-auto space-y-3">
          {chatMessages.length === 0 && (
            <div className="text-center text-gray-600 py-6">
              <p className="text-sm">New chat with {contact?.name || "user"}. Start typing or send media.</p>
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
          {(showSearch && searchQuery.trim() ? searchResults : chatMessages).map((msg: any) => (
            <MessageBubble
              key={msg.id || (msg._id?.toString?.()) || `${msg.from}-${msg.to}-${msg.timestamp || msg.createdAt}-${msg.mediaUrl || msg.text || ''}`}
              message={{
                sender: ((typeof msg.from === 'string' ? msg.from : (msg.from?.toString?.() || msg.from?.$oid || ''))) === id ? "contact" : "me",
                type: msg.type,
                text: msg.text,
                media: msg.mediaUrl,
                url: msg.mediaUrl || undefined,
                timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
                status: msg.status || "sent",
              } as any}
              isSent={((typeof msg.from === 'string' ? msg.from : (msg.from?.toString?.() || msg.from?.$oid || ''))) !== id}
              user={user}
              contact={{ id, name: headerName, avatar: headerAvatar } as any}
              theme={theme}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-t border-gray-200 p-4"
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setShowMediaPicker((prev) => !prev)}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
          >
            <ImageIcon className="w-6 h-6 text-gray-600" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className={`w-full px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 ${theme.textSize}`}
            style={{ "--tw-ring-color": theme.primary } as React.CSSProperties}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="p-3 rounded-full text-white shadow-lg"
            style={{ backgroundColor: theme.primary }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>

        {showMediaPicker && (
          <MediaPicker
            onSelect={handleMediaSelect}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </motion.div>
    </div>
  );
};

export default ChatWindow;
