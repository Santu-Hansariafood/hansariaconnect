import { useEffect, useState } from "react"
import io from "socket.io-client"

export const useChatSocket = (
  id: string,
  setChatMessages: (updater: (prev: any[]) => any[]) => void,
  mergeUnique: (prev: any[], incoming: any[]) => any[],
) => {
  const [socket, setSocket] = useState<any>(null)

  useEffect(() => {
    let s: any
    const connect = async () => {
      try { await fetch('/api/socket') } catch {}
      const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')
      const transports = isVercel ? ["polling"] : ["websocket", "polling"]
      
      s = io({ 
        path: "/api/socket", 
        transports, 
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        randomizationFactor: 0.5,
        timeout: 20000,
      })
      
      setSocket(s)
      
      s.on("connect", () => {
        console.log("Socket connected")
      })

      s.on("disconnect", (reason: string) => {
        console.log("Socket disconnected:", reason)
      })

      s.on("connect_error", (err: any) => {
        console.error("Socket connection error:", err)
      })

      s.on("reconnect_attempt", (attemptNumber: number) => {
        console.log(`Socket reconnecting, attempt ${attemptNumber}`)
      })

      s.on("reconnect", () => {
        console.log("Socket reconnected successfully")
      })

      s.on("message:new", (msg: any) => {
        if (msg?.from?.toString?.() === id || String(msg?.from) === id) {
          setChatMessages((prev) => mergeUnique(prev, [msg]))
          try {
            s.emit("message:status", { id: msg?._id?.toString?.(), status: "delivered" }, (ack: any) => {
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
              s.emit("message:status", { id: msg?._id?.toString?.(), status: "seen" }, (ack: any) => {
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
      })

      s.on("message:status:update", (data: any) => {
        if (data?.id) {
          setChatMessages((prev) => prev.map((m: any) => {
            const idStr = m?._id?.toString?.()
            if (idStr && idStr === data.id) return { ...m, status: data.status }
            return m
          }))
        }
      })
    }
    connect()
    return () => { if (s) s.disconnect() }
  }, [id, setChatMessages, mergeUnique])

  return socket
}

