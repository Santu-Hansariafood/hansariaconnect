import type { NextApiRequest, NextApiResponse } from "next"
import { Server } from "socket.io"
import cookie from "cookie"
import Message from "@/models/message/Message"
import { connectDB } from "@/lib/db/db"
import Conversation from "@/models/conversation/Conversation"
import User from "@/models/user/User"

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // @ts-ignore
  if (!(res as any).socket.server.io) {
    // @ts-ignore
    const io = new Server((res as any).socket.server, { path: "/api/socket" })
    // @ts-ignore
    ;(res as any).socket.server.io = io

    io.on("connection", async (socket) => {
      try {
        const raw = socket.request.headers.cookie || ""
        const parsed = cookie.parse(raw)
        const sessionRaw = parsed["user_session"] || ""
        let session: any = null
        try {
          session = JSON.parse(sessionRaw)
        } catch {}
        const userId = session?.id
        if (!userId) {
          socket.disconnect()
          return
        }
        await connectDB()
        socket.join(userId)

        socket.on("message:send", async (payload: any, cb: Function) => {
          try {
            const to = String(payload?.to || "")
            const exists = await User.exists({ _id: to })
            if (!exists) {
              return cb?.({ ok: false, error: "Peer not found" })
            }
            const doc = await Message.create({
              from: userId,
              to,
              type: payload?.type,
              text: payload?.text,
              mediaUrl: payload?.mediaUrl,
              fileName: payload?.fileName,
              fileSize: payload?.fileSize,
              duration: payload?.duration,
              linkTitle: payload?.linkTitle,
              linkDescription: payload?.linkDescription,
            })
            try {
              const a = String(userId)
              const b = to
              const userA = a < b ? a : b
              const userB = a < b ? b : a
              await Conversation.findOneAndUpdate(
                { userA, userB },
                { userA, userB, lastMessageAt: new Date() },
                { upsert: true }
              )
            } catch {}
            io.to(to).emit("message:new", doc)
            cb?.({ ok: true, message: doc })
          } catch (e: any) {
            cb?.({ ok: false, error: e?.message || "error" })
          }
        })

        socket.on("disconnect", () => {})
      } catch {}
    })
  }
  res.end()
}