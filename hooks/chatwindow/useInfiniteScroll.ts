import { useEffect, useRef, useState } from "react"

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

  // Reset preload flag when chat ID changes
  useEffect(() => {
    if (currentIdRef.current !== id) {
      currentIdRef.current = id
      preloadRef.current = false
      setHasMore(false)
    }
  }, [id])

  const loadMore = async () => {
    if (!chatMessages.length) return
    const el = containerRef.current
    const prevHeight = el?.scrollHeight || 0
    const prevTop = el?.scrollTop || 0
    setLoadingMore(true)
    loadingMoreRef.current = true
    try {
      const oldest = chatMessages[0]
      const tsRaw = oldest.createdAt || oldest.timestamp
      const ts = typeof tsRaw === "string" ? tsRaw : new Date(tsRaw).toISOString()
      const endpoint = isGroup
        ? `/api/groups/${id}/messages?limit=10&before=${encodeURIComponent(ts)}&t=${Date.now()}`
        : `/api/messages/${id}?limit=10&before=${encodeURIComponent(ts)}&t=${Date.now()}`
      const res = await fetch(endpoint, { credentials: 'include', cache: 'no-store' })
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

  return { containerRef, hasMore, loadingMore, loadMore, handleScroll }
}
