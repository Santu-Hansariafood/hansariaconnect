import type { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { Server as HTTPServer } from "http";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import GroupMessage from "@/models/group/GroupMessage";
import Group from "@/models/group/Group";
import { Types } from "mongoose";
import AccessControl from "@/models/access/AccessControl";
import { getUserSession } from "@/lib/sessionAuth";

export const config = {
  api: {
    bodyParser: false,
  },
};

const getUserIdFromSocket = (socket: any): string | null => {
  const session = getUserSession(socket.request || socket.handshake);
  return session?.id ?? null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const httpServer: HTTPServer = (res.socket as any).server;

  if (!(httpServer as any).userConnections) {
    (httpServer as any).userConnections = new Map<string, number>();
  }

  if (!(httpServer as any).io) {
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

    const getOnlineUserIds = () =>
      Array.from(((httpServer as any).userConnections as Map<string, number>).keys());

    const broadcastOnlineUsers = () => {
      io.emit("users:online", getOnlineUserIds());
    };

    io.on("connection", async (socket) => {
      try {
        const userId = getUserIdFromSocket(socket);
        if (!userId) {
          socket.emit("auth:error", { message: "Invalid session" });
          socket.disconnect(true);
          return;
        }

        await connectDB();

        socket.join(userId);

        const userConnections = (httpServer as any).userConnections as Map<string, number>;
        userConnections.set(userId, (userConnections.get(userId) ?? 0) + 1);
        broadcastOnlineUsers();

        socket.on("message:send", async (payload, cb) => {
          try {
            const to = String(payload?.to ?? "").trim();
            const type = String(payload?.type ?? "");
            if (!to || !Types.ObjectId.isValid(to)) {
              return cb?.({ ok: false, error: "Invalid recipient" });
            }

            const fromId = new Types.ObjectId(userId);
            const toId = new Types.ObjectId(to);
            const access = await AccessControl.findOne({ userId: fromId }).lean();
            const allowAttachments = !!(access as any)?.permissions?.attachments;
            const isText = type === "text";
            if (!isText && !allowAttachments) {
              return cb?.({ ok: false, error: "Attachments not allowed" });
            }

            const doc = await Message.create({
              from: fromId,
              to: toId,
              type,
              text: String(payload?.text ?? ""),
              mediaUrl: String(payload?.mediaUrl ?? ""),
              fileName: String(payload?.fileName ?? ""),
              fileSize: Number(payload?.fileSize ?? 0),
              duration: Number(payload?.duration ?? 0),
              linkTitle: String(payload?.linkTitle ?? ""),
              linkDescription: String(payload?.linkDescription ?? ""),
            });

            const a = String(fromId);
            const b = String(toId);
            const userA = a < b ? fromId : toId;
            const userB = a < b ? toId : fromId;

            await Conversation.findOneAndUpdate(
              { userA, userB },
              { userA, userB, lastMessageAt: new Date() },
              { upsert: true },
            );

            io.to(to).emit("message:new", doc);
            cb?.({ ok: true, message: doc });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message || "Error sending message" });
          }
        });

        socket.on("message:status", async (payload, cb) => {
          try {
            const id = String(payload?.id ?? "");
            const status = String(payload?.status ?? "") as "sent" | "delivered" | "seen";
            if (!id || !Types.ObjectId.isValid(id)) {
              return cb?.({ ok: false, error: "Invalid message id" });
            }
            if (!["sent", "delivered", "seen"].includes(status)) {
              return cb?.({ ok: false, error: "Invalid status" });
            }

            const updatedMessage = await Message.findByIdAndUpdate(
              id,
              { status },
              { new: true },
            );

            if (!updatedMessage) {
              return cb?.({ ok: false, error: "Message not found" });
            }

            io.to(String(updatedMessage.from)).emit("message:status:update", {
              id: updatedMessage._id.toString(),
              status,
            });
            cb?.({ ok: true, message: updatedMessage });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message || "Error updating status" });
          }
        });

        socket.on("group:message:send", async (payload, cb) => {
          try {
            const groupId = String(payload?.groupId ?? "").trim();
            const type = String(payload?.type ?? "");
            if (!groupId || !Types.ObjectId.isValid(groupId)) {
              return cb?.({ ok: false, error: "Invalid group" });
            }

            const fromId = new Types.ObjectId(userId);
            const group = await Group.findById(groupId);
            if (!group) {
              return cb?.({ ok: false, error: "Group not found" });
            }

            const members = group.members || [];
            const isMember = members.some((m: any) => String(m.userId) === userId);
            if (!isMember) {
              return cb?.({ ok: false, error: "Forbidden" });
            }

            const access = await AccessControl.findOne({ userId: fromId }).lean();
            const allowAttachments = !!(access as any)?.permissions?.attachments;
            const isText = type === "text";
            if (!isText && !allowAttachments) {
              return cb?.({ ok: false, error: "Attachments not allowed" });
            }

            const msg = await GroupMessage.create({
              groupId: new Types.ObjectId(groupId),
              from: fromId,
              type,
              text: String(payload?.text ?? ""),
              mediaUrl: String(payload?.mediaUrl ?? ""),
              fileName: String(payload?.fileName ?? ""),
              fileSize: Number(payload?.fileSize ?? 0),
              duration: Number(payload?.duration ?? 0),
              linkTitle: String(payload?.linkTitle ?? ""),
              linkDescription: String(payload?.linkDescription ?? ""),
            });

            members.forEach((member: any) => {
              if (String(member.userId) !== userId) {
                io.to(String(member.userId)).emit("group:message:new", msg);
              }
            });

            cb?.({ ok: true, message: msg });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message || "Error sending group message" });
          }
        });

        socket.on("disconnect", () => {
          const userConnections = (httpServer as any).userConnections as Map<string, number>;
          const count = userConnections.get(userId) ?? 0;
          if (count <= 1) {
            userConnections.delete(userId);
          } else {
            userConnections.set(userId, count - 1);
          }
          broadcastOnlineUsers();
        });
      } catch (err: any) {
        socket.disconnect(true);
      }
    });

    io.on("error", (err) => {
      console.error("Socket.IO error", err);
    });
  }

  res.end();
}
