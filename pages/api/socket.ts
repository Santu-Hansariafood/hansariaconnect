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

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const httpServer: HTTPServer = (res.socket as any).server;
  if (!(httpServer as any).io) {
    console.log("Initializing Socket.IO server...");

    const io = new ServerIO(httpServer, {
      path: "/api/socket",
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    (httpServer as any).io = io;

    io.on("connection", async (socket) => {
      console.log("Client connected");

      const raw = socket.request.headers.cookie || "";
      const parsed = cookie.parse(raw);
      let session: any = null;
      try {
        session = JSON.parse(parsed["user_session"] || "");
      } catch {}

      const userId = session?.id;
      if (!userId) {
        console.log("No session. Disconnecting");
        socket.disconnect();
        return;
      }

      await connectDB();
      socket.join(userId);

      socket.on("message:send", async (payload, cb) => {
        try {
          const fromId = new Types.ObjectId(userId);
          const toId = new Types.ObjectId(payload.to);

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

      socket.on("group:message:send", async (payload, cb) => {
        try {
          const fromId = new Types.ObjectId(userId);
          const groupId = new Types.ObjectId(payload.groupId);

          const group = await Group.findById(groupId);
          if (!group) return cb?.({ ok: false, error: "Group not found" });

          const members = group.members || [];
          const isMember = members.some((m: any) => String(m.userId) === userId);
          if (!isMember) return cb?.({ ok: false, error: "Forbidden" });

          const msg = await GroupMessage.create({
            groupId,
            from: fromId,
            type: payload.type,
            text: payload.text,
            mediaUrl: payload.mediaUrl,
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

      socket.on("disconnect", () => {
        console.log("Client disconnected");
      });
    });
  }

  res.end();
}
