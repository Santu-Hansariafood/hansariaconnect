import { useEffect, useCallback } from "react"
import { useSocket } from "../useSocket"

export const useChatSocket = (
  id: string,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  mergeUnique: (prev: any[], incoming: any[]) => any[],
  onIncomingMessage?: (msg: any) => void,
  isGroup: boolean = false,
) => {
  const { socket, addListener, removeListener } = useSocket()

  const handleNewDirectMessage = useCallback((msg: any) => {
    if (isGroup) return
    if (msg?.from?.toString?.() === id || String(msg?.from) === id) {
      onIncomingMessage?.(msg);
      setChatMessages((prev) => mergeUnique(prev, [msg]));
      try {
        socket?.emit("message:status", { id: msg?._id?.toString?.(), status: "delivered" }, (ack: any) => {
          if (ack?.ok && ack?.message?._id) {
            const mid = ack.message._id?.toString?.()
            if (mid) {
              setChatMessages((prev) => prev.map((m: any) => {
                const idStr = m?._id?.toString?.()
                if (idStr && idStr === mid) return { ...m, status: ack.message.status }
                return m
              }))
            }
          }
        })
        setTimeout(() => {
          socket?.emit("message:status", { id: msg?._id?.toString?.(), status: "seen" }, (ack: any) => {
            if (ack?.ok && ack?.message?._id) {
              const mid = ack.message._id?.toString?.()
              if (mid) {
                setChatMessages((prev) => prev.map((m: any) => {
                  const idStr = m?._id?.toString?.()
                  if (idStr && idStr === mid) return { ...m, status: ack.message.status }
                }))
              }
            }
          })
        }, 500)
        try {
          fetch('/api/read-receipts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ peerId: id })
          })
        } catch {}
      } catch {}
    }
  }, [id, setChatMessages, mergeUnique, socket, isGroup, onIncomingMessage])

  const handleNewGroupMessage = useCallback((msg: any) => {
    if (!isGroup) return
    if (String(msg?.groupId) === id) {
      onIncomingMessage?.(msg);
      setChatMessages((prev) => mergeUnique(prev, [msg]));
      try {
        fetch('/api/read-receipts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ groupId: id })
        })
      } catch {}
    }
  }, [id, setChatMessages, mergeUnique, isGroup, onIncomingMessage])

  const handleStatusUpdate = useCallback((data: any) => {
    if (data?.id) {
      setChatMessages((prev) => prev.map((m: any) => {
        const idStr = m?._id?.toString?.()
        if (idStr && idStr === data.id) return { ...m, status: data.status }
        return m
      }))
    }
  }, [setChatMessages])

  useEffect(() => {
    addListener("message:new", handleNewDirectMessage)
    addListener("group:message:new", handleNewGroupMessage)
    addListener("message:status:update", handleStatusUpdate)

    return () => {
      removeListener("message:new", handleNewDirectMessage)
      removeListener("group:message:new", handleNewGroupMessage)
      removeListener("message:status:update", handleStatusUpdate)
    }
  }, [addListener, removeListener, handleNewDirectMessage, handleNewGroupMessage, handleStatusUpdate])

  return socket
}
