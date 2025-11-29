import { useEffect, useRef, useState } from "react"

export const useUnreadBehavior = (
  id: string,
  chatMessages: any[],
  socket: any,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
) => {
  const [unreadOnOpen, setUnreadOnOpen] = useState(0)
  const [showUnreadBanner, setShowUnreadBanner] = useState(false)
  const unreadDividerRef = useRef<HTMLDivElement | null>(null)
  const hasScrolledToUnreadRef = useRef<boolean>(false)
  const initializedRef = useRef<boolean>(false)

  useEffect(() => {
    const fromId = (x: any) => ((typeof x.from === 'string' ? x.from : (x.from?.toString?.() || x.from?.$oid || ''))) as string
    if (!initializedRef.current && Array.isArray(chatMessages) && chatMessages.length) {
      const initialUnread = chatMessages.filter((m: any) => fromId(m) === id && (m.status || 'sent') !== 'seen').length
      setUnreadOnOpen(initialUnread)
      setShowUnreadBanner(initialUnread > 0)
      initializedRef.current = true
    }
  }, [chatMessages, id])

  useEffect(() => {
    if (unreadOnOpen > 0 && unreadDividerRef.current && !hasScrolledToUnreadRef.current) {
      unreadDividerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      hasScrolledToUnreadRef.current = true
    }
  }, [chatMessages, unreadOnOpen])

  useEffect(() => {
    const fromId = (x: any) => ((typeof x.from === 'string' ? x.from : (x.from?.toString?.() || x.from?.$oid || ''))) as string
    const pending = chatMessages.filter((m: any) => fromId(m) === id && (m.status || 'sent') !== 'seen')
    if (!pending.length) return
    const delay = (unreadOnOpen > 0 && !hasScrolledToUnreadRef.current) ? 400 : 0
    const t = setTimeout(() => {
      setChatMessages((prev) => prev.map((m: any) => {
        const f = fromId(m)
        if (f === id && (m.status || 'sent') !== 'seen') return { ...m, status: 'seen' }
        return m
      }))
      try {
        pending.forEach((m: any) => {
          const mid = m?._id?.toString?.()
          if (mid && socket) socket.emit("message:status", { id: mid, status: "seen" })
        })
      } catch {}
      try {
        fetch('/api/read-receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ peerId: id })
        })
      } catch {}
      setShowUnreadBanner(false)
      setUnreadOnOpen(0)
    }, delay)
    return () => clearTimeout(t)
  }, [chatMessages, id, socket, unreadOnOpen])

  return { unreadOnOpen, showUnreadBanner, setShowUnreadBanner, unreadDividerRef, hasScrolledToUnreadRef }
}

