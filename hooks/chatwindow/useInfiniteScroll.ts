import { useEffect, useRef, useState, useCallback } from "react"

export const useInfiniteScroll = (
  id: string,
  chatMessages: any[],
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  mergeUnique: (prev: any[], incoming: any[]) => any[],
  isGroup: boolean = false,
) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const loadingMoreRef = useRef(false)
  const preloadRef = useRef(false)
  const currentIdRef = useRef(id)
  const chatMessagesRef = useRef(chatMessages)
  const hasMoreRef = useRef(hasMore)

  useEffect(() => {
    chatMessagesRef.current = chatMessages
  }, [chatMessages])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    if (currentIdRef.current !== id) {
      currentIdRef.current = id
      preloadRef.current = false
      setHasMore(false)
      hasMoreRef.current = false
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [id])

  const loadMore = useCallback(async () => {
    const currentMessages = chatMessagesRef.current
    if (!currentMessages.length) return
    if (loadingMoreRef.current) return
    if (!hasMoreRef.current) return

    const el = containerRef.current
    const prevHeight = el?.scrollHeight || 0
    const prevTop = el?.scrollTop || 0
    setLoadingMore(true)
    loadingMoreRef.current = true
    try {
      const oldest = currentMessages[0]
      const tsRaw = oldest.createdAt || oldest.timestamp
      const ts = typeof tsRaw === "string" ? tsRaw : new Date(tsRaw).toISOString()
      const endpoint = isGroup
        ? `/api/groups/${id}/messages?limit=10&before=${encodeURIComponent(ts)}&t=${Date.now()}`
        : `/api/messages/${id}?limit=10&before=${encodeURIComponent(ts)}&t=${Date.now()}`
      const res = await fetch(endpoint, { credentials: 'include', cache: 'no-store' })
      if (!res.ok) {
        console.warn(
          "[useInfiniteScroll] loadMore HTTP",
          res.status,
          "for chat",
          id,
        )
        setHasMore(false)
        hasMoreRef.current = false
        return
      }
      const data = await res.json()
      if (Array.isArray(data?.messages) && data.messages.length) {
        setChatMessages((prev) => mergeUnique(prev, data.messages))
        const nextHasMore = !!data?.hasMore
        setHasMore(nextHasMore)
        hasMoreRef.current = nextHasMore
        const applyScroll = () => {
          const el2 = containerRef.current
          if (el2) {
            const newHeight = el2.scrollHeight || 0
            const delta = newHeight - prevHeight
            if (delta > 0) {
              el2.scrollTop = prevTop + delta
            }
          }
        }
        if (typeof window !== "undefined") {
          window.requestAnimationFrame(applyScroll)
        } else {
          applyScroll()
        }
      } else {
        setHasMore(false)
        hasMoreRef.current = false
      }
    } catch (err: any) {
      console.error(
        "[useInfiniteScroll] loadMore error:",
        err?.message || err,
      )
    } finally {
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [id, isGroup, mergeUnique, setChatMessages])

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (loadingMoreRef.current) return
    if (!hasMoreRef.current) return
    const target = e.currentTarget
    if (target.scrollTop <= 10) {
      void loadMore()
    }
  }, [loadMore])

  useEffect(() => {
    const run = async () => {
      if (preloadRef.current) return
      if (!hasMoreRef.current) return
      if (chatMessagesRef.current.length >= 40) return
      preloadRef.current = true
      for (let i = 0; i < 3; i++) {
        if (!hasMoreRef.current) break
        await loadMore()
        await new Promise((r) => setTimeout(r, 200))
      }
      preloadRef.current = false
    }
    void run()
  }, [hasMore, id, loadMore])

  return { containerRef, hasMore, setHasMore, loadingMore, loadMore, handleScroll }
}
