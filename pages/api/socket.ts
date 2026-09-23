import type { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO } from "socket.io";
import { Server as HTTPServer } from "http";
import { z } from "zod";
import { connectDB } from "@/lib/db/db";
import Message from "@/models/message/Message";
import Conversation from "@/models/conversation/Conversation";
import GroupMessage from "@/models/group/GroupMessage";
import Group from "@/models/group/Group";
import User from "@/models/user/User";
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
import { redisDel, CacheKeys } from "@/lib/redis/redis";

export const config = {
  api: {
    bodyParser: false,
  },
};

const messagePayloadSchema = z.object({
  to: z.string().regex(/^[0-9a-fA-F]{24}$/),
  type: z.enum(["text", "image", "video", "voice", "pdf", "excel", "link", "file"]),
  text: z.string().max(10000).optional(),
  mediaUrl: z.string().max(2000).optional(),
  fileName: z.string().max(255).optional(),
  fileSize: z.string().max(32).optional(),
  duration: z.number().finite().min(0).max(3600).optional(),
  linkTitle: z.string().max(500).optional(),
  linkDescription: z.string().max(5000).optional(),
});

const groupMessagePayloadSchema = messagePayloadSchema
  .omit({ to: true })
  .extend({ groupId: z.string().regex(/^[0-9a-fA-F]{24}$/) });

const allowedOrigins = new Set(
  [process.env.NEXT_PUBLIC_APP_URL, "http://localhost:4000"]
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => origin.replace(/\/$/, "")),
);

const isAllowedOrigin = (origin?: string): boolean =>
  !origin || allowedOrigins.has(origin.replace(/\/$/, ""));

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
        origin: Array.from(allowedOrigins),
        methods: ["GET", "POST"],
        credentials: true,
      },
      allowRequest: (request, callback) => {
        callback(null, isAllowedOrigin(request.headers.origin));
      },
      maxHttpBufferSize: 1e6,
      pingInterval: 25000,
      pingTimeout: 20000,
      connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000,
        skipMiddlewares: false,
      },
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
        const prevCount = userConnections.get(userId) ?? 0;
        userConnections.set(userId, prevCount + 1);

        if (Types.ObjectId.isValid(userId)) {
          void User.findByIdAndUpdate(new Types.ObjectId(userId), {
            $set: { lastSeenAt: new Date() },
          }).catch(() => {});
          void redisDel(CacheKeys.lastSeenSingle(userId));
        }

        socket.emit("users:online", getOnlineUserIds());
        io.except(socket.id).emit("user:online", { userId });

        socket.on("message:send", async (payload, cb) => {
          try {
            const parsedPayload = messagePayloadSchema.safeParse(payload);
            if (!parsedPayload.success) {
              return cb?.({ ok: false, error: "Invalid message payload" });
            }
            const data = parsedPayload.data;
            const to = data.to;
            const type = data.type;

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
                data.text ?? "",
              ),
              mediaUrl: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                data.mediaUrl ?? "",
              ),
              fileName: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                data.fileName ?? "",
              ),
              fileSize: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                data.fileSize ?? "",
              ),
              duration: data.duration,
              linkTitle: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                data.linkTitle ?? "",
              ),
              linkDescription: encryptDirectMessageContent(
                userIdStr,
                toIdStr,
                data.linkDescription ?? "",
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
            const parsedPayload = groupMessagePayloadSchema.safeParse(payload);
            if (!parsedPayload.success) {
              return cb?.({ ok: false, error: "Invalid group message payload" });
            }
            const data = parsedPayload.data;
            const groupId = data.groupId;
            const type = data.type;

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
                data.text ?? "",
              ),
              mediaUrl: encryptGroupMessageContent(
                groupIdStr,
                data.mediaUrl ?? "",
              ),
              fileName: encryptGroupMessageContent(
                groupIdStr,
                data.fileName ?? "",
              ),
              fileSize: encryptGroupMessageContent(
                groupIdStr,
                data.fileSize ?? "",
              ),
              duration: data.duration,
              linkTitle: encryptGroupMessageContent(
                groupIdStr,
                data.linkTitle ?? "",
              ),
              linkDescription: encryptGroupMessageContent(
                groupIdStr,
                data.linkDescription ?? "",
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

            if (Types.ObjectId.isValid(userId)) {
              const now = new Date();
              void User.findByIdAndUpdate(new Types.ObjectId(userId), {
                $set: { lastSeenAt: now },
              }).catch(() => {});
              void redisDel(CacheKeys.lastSeenSingle(userId));
              io.emit("user:last-seen", {
                userId,
                lastSeenAt: now.toISOString(),
              });
            }
          } else {
            userConnections.set(userId, count - 1);
          }
          io.emit("user:offline", { userId });
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