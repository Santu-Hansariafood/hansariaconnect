import type { NextApiRequest, NextApiResponse } from "next"
import { Server } from "socket.io"
import cookie from "cookie"
import Message from "@/models/message/Message"
import { connectDB } from "@/lib/db/db"
import Conversation from "@/models/conversation/Conversation"
import { Types } from "mongoose"

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
            const fromId = new Types.ObjectId(String(userId))
            const toId = new Types.ObjectId(String(payload?.to))
            
            const doc = await Message.create({
              from: fromId,
              to: toId,
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
              const a = String(fromId)
              const b = String(toId)
              const userA = a < b ? fromId : toId
              const userB = a < b ? toId : fromId
              await Conversation.findOneAndUpdate(
                { userA, userB },
                { userA, userB, lastMessageAt: new Date() },
                { upsert: true }
              )
            } catch {}
            io.to(payload?.to).emit("message:new", doc)
            cb?.({ ok: true, message: doc })
          } catch (e: any) {
            cb?.({ ok: false, error: e?.message || "error" })
          }
        })

        socket.on("message:status", async (payload: any, cb: Function) => {
          try {
            const id = String(payload?.id || "")
            const status = String(payload?.status || "")
            if (!id || !status) {
              cb?.({ ok: false, error: "invalid" })
              return
            }
            const doc = await Message.findById(id)
            if (!doc) {
              cb?.({ ok: false, error: "not_found" })
              return
            }
            if (String(doc.to) !== String(userId) && String(doc.from) !== String(userId)) {
              cb?.({ ok: false, error: "forbidden" })
              return
            }
            doc.status = status as any
            await doc.save()
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