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
import {
  encryptDirectMessageContent,
  decryptDirectMessageContent,
  encryptGroupMessageContent,
  decryptGroupMessageContent,
} from "@/lib/crypto";
import {
  emitDirectMessageReceived,
  emitGroupMessageReceived,
} from "@/lib/socketEmitter";

export const config = {
  api: {
    bodyParser: false,
  },
};

const getUserIdFromSocket = async (socket: any): Promise<string | null> => {
  const session = await getUserSession(socket.request || socket.handshake);
  return session?.id ?? null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const httpServer: HTTPServer = (res.socket as any).server;

  if (!(httpServer as any).userConnections) {
    (httpServer as any).userConnections = new Map<string, number>();
  }

  if (!(httpServer as any).io) {
    const io = new ServerIO(httpServer, {
      path: "/api/socket",
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL
          ? [process.env.NEXT_PUBLIC_APP_URL]
          : true,
        methods: ["GET", "POST"],
        credentials: true,
      },
      allowEIO3: true,
    });

    (httpServer as any).io = io;
    // expose io and userConnections for other server routes to emit events
    try {
      (globalThis as any).__io = io;
      (globalThis as any).__userConnections = (
        httpServer as any
      ).userConnections;
    } catch {}

    const getOnlineUserIds = () =>
      Array.from(
        ((httpServer as any).userConnections as Map<string, number>).keys(),
      );

    const broadcastOnlineUsers = () => {
      io.emit("users:online", getOnlineUserIds());
    };

    io.on("connection", async (socket) => {
      try {
        const userId = await getUserIdFromSocket(socket);
        if (!userId) {
          socket.emit("auth:error", { message: "Invalid session" });
          socket.disconnect(true);
          return;
        }

        await connectDB();

        socket.join(userId);

        const userConnections = (httpServer as any).userConnections as Map<
          string,
          number
        >;
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
            const access = await AccessControl.findOne({
              userId: fromId,
            }).lean();
            const allowAttachments = !!(access as any)?.permissions
              ?.attachments;
            const isText = type === "text";
            if (!isText && !allowAttachments) {
              return cb?.({ ok: false, error: "Attachments not allowed" });
            }

            const userIdStr = String(fromId);
            const toIdStr = String(toId);

            const doc = await Message.create({
              from: fromId,
              to: toId,
              type,
              text: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.text ?? ""),
              ),
              mediaUrl: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.mediaUrl ?? ""),
              ),
              fileName: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.fileName ?? ""),
              ),
              fileSize: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.fileSize ?? ""),
              ),
              duration: Number(payload?.duration ?? 0),
              linkTitle: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.linkTitle ?? ""),
              ),
              linkDescription: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                String(payload?.linkDescription ?? ""),
              ),
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

            const decryptedForSender: any = {
              ...doc.toObject(),
              text: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.text || "",
              ),
              mediaUrl: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.mediaUrl || "",
              ),
              fileName: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.fileName || "",
              ),
              fileSize: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.fileSize || "",
              ),
              linkTitle: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.linkTitle || "",
              ),
              linkDescription: decryptDirectMessageContent(
                userIdStr,
                toIdStr,
                doc.linkDescription || "",
              ),
            };

            const decryptedForRecipient: any = {
              ...doc.toObject(),
              text: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.text || "",
              ),
              mediaUrl: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.mediaUrl || "",
              ),
              fileName: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.fileName || "",
              ),
              fileSize: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.fileSize || "",
              ),
              linkTitle: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.linkTitle || "",
              ),
              linkDescription: decryptDirectMessageContent(
                toIdStr,
                userIdStr,
                doc.linkDescription || "",
              ),
            };

            io.to(to).emit("message:new", decryptedForRecipient);
            cb?.({ ok: true, message: decryptedForSender });
            void emitDirectMessageReceived(
              userIdStr,
              toIdStr,
              decryptedForRecipient,
            );
          } catch (err: any) {
            cb?.({ ok: false, error: err.message || "Error sending message" });
          }
        });

        socket.on("message:status", async (payload, cb) => {
          try {
            const id = String(payload?.id ?? "");
            const status = String(payload?.status ?? "") as
              | "sent"
              | "delivered"
              | "seen";
            if (!id || !Types.ObjectId.isValid(id)) {
              return cb?.({ ok: false, error: "Invalid message id" });
            }
            if (!["sent", "delivered", "seen"].includes(status)) {
              return cb?.({ ok: false, error: "Invalid status" });
            }

            const message = await Message.findById(id);

            if (!message) {
              return cb?.({ ok: false, error: "Message not found" });
            }

            const currentUserId = String(userId);

            // A message status may only be changed by the sender or recipient.
            if (
              String(message.from) !== currentUserId &&
              String(message.to) !== currentUserId
            ) {
              return cb?.({ ok: false, error: "Forbidden" });
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

            if (String(updatedMessage.to) !== String(updatedMessage.from)) {
              io.to(String(updatedMessage.to)).emit("message:status:update", {
                id: updatedMessage._id.toString(),
                status,
              });
            }
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
            const isMember = members.some(
              (m: any) => String(m.userId) === userId,
            );
            if (!isMember) {
              return cb?.({ ok: false, error: "Forbidden" });
            }

            const access = await AccessControl.findOne({
              userId: fromId,
            }).lean();
            const allowAttachments = !!(access as any)?.permissions
              ?.attachments;
            const isText = type === "text";
            if (!isText && !allowAttachments) {
              return cb?.({ ok: false, error: "Attachments not allowed" });
            }

            const groupIdStr = String(groupId);
            const userIdStr = String(fromId);

            const msg = await GroupMessage.create({
              groupId: new Types.ObjectId(groupId),
              from: fromId,
              type,
              text: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.text ?? ""),
              ),
              mediaUrl: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.mediaUrl ?? ""),
              ),
              fileName: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.fileName ?? ""),
              ),
              fileSize: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.fileSize ?? ""),
              ),
              duration: Number(payload?.duration ?? 0),
              linkTitle: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.linkTitle ?? ""),
              ),
              linkDescription: encryptGroupMessageContent(
                groupIdStr,
                String(payload?.linkDescription ?? ""),
              ),
            });

            const decryptedMsg: any = {
              ...msg.toObject(),
              text: decryptGroupMessageContent(groupIdStr, msg.text || ""),
              mediaUrl: decryptGroupMessageContent(
                groupIdStr,
                msg.mediaUrl || "",
              ),
              fileName: decryptGroupMessageContent(
                groupIdStr,
                msg.fileName || "",
              ),
              fileSize: decryptGroupMessageContent(
                groupIdStr,
                msg.fileSize || "",
              ),
              linkTitle: decryptGroupMessageContent(
                groupIdStr,
                msg.linkTitle || "",
              ),
              linkDescription: decryptGroupMessageContent(
                groupIdStr,
                msg.linkDescription || "",
              ),
            };

            members.forEach((member: any) => {
              if (String(member.userId) !== userId) {
                io.to(String(member.userId)).emit(
                  "group:message:new",
                  decryptedMsg,
                );
              }
            });

            cb?.({ ok: true, message: decryptedMsg });
            void emitGroupMessageReceived(
              groupIdStr,
              userIdStr,
              members,
              decryptedMsg,
            );
          } catch (err: any) {
            cb?.({
              ok: false,
              error: err.message || "Error sending group message",
            });
          }
        });

        socket.on("disconnect", () => {
          const userConnections = (httpServer as any).userConnections as Map<
            string,
            number
          >;
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

    io.on("error", () => {
      // Silent socket server error handling to avoid runtime exceptions.
    });
  }

  res.end();
}