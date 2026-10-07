import { useEffect, useRef, useState } from "react"

export const useUnreadBehavior = (
  id: string,
  chatMessages: any[],
  socket: any,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  isGroup = false,
  userId?: string | number,
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
    const fromId = (x: any) => ((typeof x.from === 'string' ? x.from : (x.from?.toString?.() || x.from?.$oid || ''))) as string
    const pending = chatMessages.filter((m: any) => {
      const senderId = fromId(m)
      const isIncoming = isGroup
        ? Boolean(senderId) && senderId !== String(userId || "")
        : senderId === id
      return isIncoming && (m.status || 'sent') !== 'seen'
    })
    if (!pending.length) return
    const delay = (unreadOnOpen > 0 && !hasScrolledToUnreadRef.current) ? 400 : 0
    const t = setTimeout(() => {
      setChatMessages((prev) => prev.map((m: any) => {
        const f = fromId(m)
        const isIncoming = isGroup
          ? Boolean(f) && f !== String(userId || "")
          : f === id
        if (isIncoming && (m.status || 'sent') !== 'seen') return { ...m, status: 'seen' }
        return m
      }))
      try {
        pending.forEach((m: any) => {
          const mid = m?._id?.toString?.() || m?.id?.toString?.()
          if (mid && socket && !isGroup) socket.emit("message:status", { id: mid, status: "seen" })
        })
      } catch {}
      try {
        fetch('/api/read-receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(isGroup ? { groupId: id } : { peerId: id })
        })
      } catch {}
      setShowUnreadBanner(false)
      setUnreadOnOpen(0)
    }, delay)
    return () => clearTimeout(t)
  }, [chatMessages, id, isGroup, socket, unreadOnOpen, userId])

  return { unreadOnOpen, showUnreadBanner, setShowUnreadBanner, unreadDividerRef, hasScrolledToUnreadRef }
}
