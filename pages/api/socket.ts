import type { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { Server as HTTPServer } from "http";
import cookie from "cookie";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import GroupMessage from "@/models/group/GroupMessage";
import Group from "@/models/group/Group";
import { Types } from "mongoose";
import AccessControl from "@/models/access/AccessControl";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("Socket API route hit, method:", req.method);
  const httpServer: HTTPServer = (res.socket as any).server;
  
  // Initialize online users map if not exists
  if (!(httpServer as any).onlineUsers) {
    (httpServer as any).onlineUsers = new Set();
  }
  
  if (!(httpServer as any).io) {
    console.log("Initializing Socket.IO server...");

    const io = new ServerIO(httpServer, {
      path: "/api/socket",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      allowEIO3: true,
    });

    (httpServer as any).io = io;

    io.on("connection", async (socket) => {
      console.log("Client connected, socket id:", socket.id);
      console.log("Incoming cookies:", socket.request.headers.cookie);

      const raw = socket.request.headers.cookie || "";
      const parsed = cookie.parse(raw);
      let session: any = null;
      try {
        session = JSON.parse(parsed["user_session"] || "");
        console.log("Parsed session:", session);
      } catch (err) {
        console.error("Failed to parse user_session cookie:", err);
      }

      const userId = session?.id;
      if (!userId) {
        console.log("No userId in session. Disconnecting socket:", socket.id);
        socket.disconnect();
        return;
      }

      await connectDB();
      socket.join(userId);
      
      // Add user to online users and broadcast to all
      (httpServer as any).onlineUsers.add(userId);
      io.emit("users:online", Array.from((httpServer as any).onlineUsers));

      socket.on("message:send", async (payload, cb) => {
        try {
          const fromId = new Types.ObjectId(userId);
          const toId = new Types.ObjectId(payload.to);
          const access = await AccessControl.findOne({ userId: fromId }).lean();
          const allowAttachments = !!(access as any)?.permissions?.attachments;
          const isText = String(payload.type) === "text";
          if (!isText && !allowAttachments) {
            return cb?.({ ok: false, error: "Attachments not allowed" });
          }

          const doc = await Message.create({
            from: fromId,
            to: toId,
            type: payload.type,
            text: payload.text,
            mediaUrl: payload.mediaUrl,
            fileName: payload.fileName,
            fileSize: payload.fileSize,
            duration: payload.duration,
            linkTitle: payload.linkTitle,
            linkDescription: payload.linkDescription,
          });

          const a = String(fromId);
          const b = String(toId);
          const userA = a < b ? fromId : toId;
          const userB = a < b ? toId : fromId;

          await Conversation.findOneAndUpdate(
            { userA, userB },
            { userA, userB, lastMessageAt: new Date() },
            { upsert: true }
          );

          io.to(payload.to).emit("message:new", doc);

          cb?.({ ok: true, message: doc });
        } catch (err: any) {
          cb?.({ ok: false, error: err.message || "Error" });
        }
      });

      socket.on("message:status", async (payload, cb) => {
        try {
          const messageId = new Types.ObjectId(payload.id);
          const status = payload.status as "sent" | "delivered" | "seen";

          const updatedMessage = await Message.findByIdAndUpdate(
            messageId,
            { status },
            { new: true }
          );

          if (updatedMessage) {
            io.to(String(updatedMessage.from)).emit("message:status:update", {
              id: updatedMessage._id.toString(),
              status,
            });

            cb?.({ ok: true, message: updatedMessage });
          } else {
            cb?.({ ok: false, error: "Message not found" });
          }
        } catch (err: any) {
          cb?.({ ok: false, error: err.message || "Error updating status" });
        }
      });

      socket.on("group:message:send", async (payload, cb) => {
        try {
          const fromId = new Types.ObjectId(userId);
          const groupId = new Types.ObjectId(payload.groupId);

          const group = await Group.findById(groupId);
          if (!group) return cb?.({ ok: false, error: "Group not found" });

          const members = group.members || [];
          const isMember = members.some((m: any) => String(m.userId) === userId);
          if (!isMember) return cb?.({ ok: false, error: "Forbidden" });
          const access = await AccessControl.findOne({ userId: fromId }).lean();
          const allowAttachments = !!(access as any)?.permissions?.attachments;
          const isText = String(payload.type) === "text";
          if (!isText && !allowAttachments) {
            return cb?.({ ok: false, error: "Attachments not allowed" });
          }

          const msg = await GroupMessage.create({
            groupId,
            from: fromId,
            type: payload.type,
            text: payload.text,
            mediaUrl: payload.mediaUrl,
            fileName: payload.fileName,
            fileSize: payload.fileSize,
            duration: payload.duration,
            linkTitle: payload.linkTitle,
            linkDescription: payload.linkDescription,
          });

          members.forEach((m: any) => {
            if (String(m.userId) !== userId) {
              io.to(String(m.userId)).emit("group:message:new", msg);
            }
          });

          cb?.({ ok: true, message: msg });
        } catch (err: any) {
          cb?.({ ok: false, error: err.message });
        }
      });

      socket.on("disconnect", (reason: string) => {
        console.log("Client disconnected, socket id:", socket.id, "reason:", reason, "userId:", userId);
        (httpServer as any).onlineUsers.delete(userId);
        io.emit("users:online", Array.from((httpServer as any).onlineUsers));
      });
    });
  }

  res.end();
}
