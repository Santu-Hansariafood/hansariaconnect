import type { NextApiRequest, NextApiResponse } from "next";
import { Server as ServerIO, type Socket } from "socket.io";
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
import Admin from "@/models/admin/Admin";
import {
  getAdminSession,
  getUserSession,
  userSessionCookieOptions,
} from "@/lib/sessionAuth";
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
import {
  redisDel,
  CacheKeys,
  invalidateDirectMessages,
} from "@/lib/redis/redis";
import {
  configureSocketRedisAdapter,
  getSocketRedisClient,
} from "@/lib/socketRedisAdapter";
import {
  PRESENCE_HEARTBEAT_MS,
  PRESENCE_TTL_MS,
  onlineUsersKey,
  userSocketsKey,
} from "@/lib/presence";

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

const SESSION_REVALIDATE_INTERVAL_MS = Number(
  process.env.SOCKET_SESSION_REVALIDATE_MS || 30_000,
);
const GROUP_MEMBERS_TTL_MS = 30_000;
const GROUP_MEMBERS_CACHE_LIMIT = 5_000;

const groupMembersCache = new Map<
  string,
  { memberIds: string[]; expiresAt: number }
>();

const getGroupMemberIds = async (groupId: string): Promise<string[] | null> => {
  const cached = groupMembersCache.get(groupId);
  if (cached && cached.expiresAt > Date.now()) return cached.memberIds;

  const group = await Group.findById(groupId).select("members.userId").lean<{
    members?: Array<{ userId?: unknown }>;
  } | null>();

  if (!group) return null;

  const memberIds = (group.members || [])
    .map((member) => String(member?.userId ?? ""))
    .filter(Boolean);

  if (groupMembersCache.size >= GROUP_MEMBERS_CACHE_LIMIT) {
    groupMembersCache.clear();
  }
  groupMembersCache.set(groupId, {
    memberIds,
    expiresAt: Date.now() + GROUP_MEMBERS_TTL_MS,
  });

  return memberIds;
};

const startPresenceSweep = async (io: ServerIO, httpServer: HTTPServer) => {
  const server = httpServer as any;
  if (server.presenceSweepTimer) return;

  const redis = await getSocketRedisClient();
  if (!redis) return;

  const timer = setInterval(() => {
    void (async () => {
      try {
        const now = Date.now();
        const expiredUsers = await redis.zrangebyscore(
          onlineUsersKey,
          "-inf",
          now,
        );
        if (expiredUsers.length === 0) return;
        await redis.zremrangebyscore(onlineUsersKey, "-inf", now);
        expiredUsers.forEach((expiredUserId) => {
          io.emit("user:offline", { userId: expiredUserId });
        });
      } catch (error) {
        console.error("[Socket.IO] Presence cleanup failed:", error);
      }
    })();
  }, PRESENCE_HEARTBEAT_MS);
  timer.unref();
  server.presenceSweepTimer = timer;
};

const configuredOrigins = [process.env.NEXT_PUBLIC_APP_URL, "http://localhost:4000"]
  .filter((origin): origin is string => Boolean(origin))
  .flatMap((origin) => {
    try {
      const url = new URL(origin);
      return [
        url.origin,
        ...["admin", "super", "web"].map(
          (subdomain) =>
            `${url.protocol}//${subdomain}.${url.host}`,
        ),
      ];
    } catch {
      console.error("[Socket.IO] Ignoring invalid NEXT_PUBLIC_APP_URL origin");
      return [];
    }
  });
const allowedOrigins = new Set(configuredOrigins);

/**
 * Allows every configured origin plus any request whose `Origin` matches the
 * `Host` it was served from. The client always connects to `window.location.origin`,
 * so without the same-host allowance a deployment reached through a domain (or
 * LAN IP / 127.0.0.1) that is not listed in NEXT_PUBLIC_APP_URL would have every
 * socket handshake rejected — no new-message previews or unread badges would
 * reach the browser until a manual refresh re-fetched the conversation list.
 */
const isAllowedOrigin = (origin?: string, host?: string): boolean => {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, "");
  if (allowedOrigins.has(normalizedOrigin)) return true;

  if (!host) return false;

  try {
    return new URL(normalizedOrigin).host === host.replace(/\/$/, "");
  } catch {
    return false;
  }
};

const getAdminNotificationUserId = async (
  socket: Socket,
): Promise<string | null> => {
  const session = await getAdminSession(socket.request || socket.handshake);
  if (
    !session ||
    session.keyLogin ||
    typeof session.adminId !== "string" ||
    typeof session.userId !== "string" ||
    !Types.ObjectId.isValid(session.userId)
  ) {
    return null;
  }

  await connectDB();
  const admin = await Admin.findById(session.adminId)
    .select("userId")
    .lean<{ userId?: string } | null>();

  if (!admin?.userId || !Types.ObjectId.isValid(admin.userId)) {
    return null;
  }

  const linkedUserId = new Types.ObjectId(admin.userId).toString();
  return linkedUserId === new Types.ObjectId(session.userId).toString()
    ? linkedUserId
    : null;
};

async function handleSocketRequest(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const httpServer = (res.socket as any)?.server as HTTPServer | undefined;
  if (!httpServer || typeof httpServer.on !== "function") {
    throw new Error(
      "Socket.IO requires a persistent Node.js HTTP server for this API request",
    );
  }

  if (!(httpServer as any).userConnections) {
    (httpServer as any).userConnections = new Map<string, number>();
  }

  const ensureSocketAdapterReady = (): Promise<void> => {
    const server = httpServer as any;
    if (server.socketAdapterReady) {
      return server.socketAdapterReady as Promise<void>;
    }

    const io = server.io as ServerIO | undefined;
    if (!io) {
      return Promise.reject(new Error("Socket.IO server is not initialized"));
    }

    const readiness = configureSocketRedisAdapter(io);
    server.socketAdapterReady = readiness;
    void readiness.then(() => startPresenceSweep(io, httpServer)).catch((error) => {
      console.error("[Socket.IO] Could not start presence cleanup:", error);
    });
    void readiness.catch(() => {
      if (server.socketAdapterReady === readiness) {
        server.socketAdapterReady = null;
      }
    });
    return readiness;
  };

  if (!(httpServer as any).io) {
    const io = new ServerIO(httpServer, {
      path: "/api/socket",
      cors: {
        origin: Array.from(allowedOrigins),
        methods: ["GET", "POST"],
        credentials: true,
      },
      allowRequest: (request, callback) => {
        callback(
          null,
          isAllowedOrigin(request.headers.origin, request.headers.host),
        );
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
    try {
      (globalThis as any).__io = io;
      (globalThis as any).__userConnections = (
        httpServer as any
      ).userConnections;
    } catch {}

    const getOnlineUserIds = async () => {
      const redis = await getSocketRedisClient();
      if (redis) {
        const now = Date.now();
        await redis.zremrangebyscore(onlineUsersKey, "-inf", now);
        return redis.zrangebyscore(onlineUsersKey, now, "+inf");
      }
      return Array.from(
        ((httpServer as any).userConnections as Map<string, number>).keys(),
      );
    };

    io.use((socket, next) => {
      void (async () => {
        try {
          await ensureSocketAdapterReady();
          const userSession = await getUserSession(
            socket.request || socket.handshake,
          );

          if (userSession?.id && Types.ObjectId.isValid(userSession.id)) {
            await connectDB();
            const activeSession = await User.exists({
              _id: new Types.ObjectId(userSession.id),
              "sessions.sessionId": userSession.sessionId,
            });
            if (!activeSession) {
              throw new Error("User session is no longer active");
            }

            socket.data.authenticatedUserId = new Types.ObjectId(
              userSession.id,
            ).toString();
            socket.data.authenticatedSessionId = userSession.sessionId;
            socket.data.authenticatedAs = "user";
            try {
              const adminUserId = await getAdminNotificationUserId(socket);
              if (adminUserId === socket.data.authenticatedUserId) {
                socket.data.adminNotificationUserId = adminUserId;
              }
            } catch (error) {
              console.warn(
                "[Socket.IO] Admin notification identity was not available:",
                error instanceof Error ? error.message : "Unknown error",
              );
            }
            next();
            return;
          }

          const adminUserId = await getAdminNotificationUserId(socket);
          if (!adminUserId) {
            throw new Error("Valid user or admin session required");
          }

          socket.data.authenticatedUserId = adminUserId;
          socket.data.authenticatedAs = "admin-notifications";
          next();
        } catch (error) {
          console.warn(
            "[Socket.IO] Connection authentication failed:",
            error instanceof Error ? error.message : "Unknown authentication error",
          );
          next(new Error("Authentication failed"));
        }
      })();
    });

    io.on("connection", async (socket) => {
      try {
        const userId = String(socket.data.authenticatedUserId || "");
        const sessionId = String(socket.data.authenticatedSessionId || "");
        if (socket.data.authenticatedAs === "admin-notifications") {
          await connectDB();
          socket.join(`admin-notifications:${userId}`);
          return;
        }

        if (
          socket.data.authenticatedAs !== "user" ||
          !userId ||
          !sessionId
        ) {
          socket.disconnect(true);
          return;
        }

        await connectDB();

        socket.join(userId);
        socket.join(`user-session:${sessionId}`);

        let lastSessionCheckAt = Date.now();
        let sessionCheckInFlight: Promise<boolean> | null = null;

        const isSessionActive = async (): Promise<boolean> => {
          const activeSession = await User.exists({
            _id: new Types.ObjectId(userId),
            sessions: {
              $elemMatch: {
                sessionId,
                createdAt: {
                  $gt:
                    Date.now() -
                    userSessionCookieOptions.maxAge * 1000,
                },
              },
            },
          });
          return Boolean(activeSession);
        };

        socket.use((packet, next) => {
          if (Date.now() - lastSessionCheckAt < SESSION_REVALIDATE_INTERVAL_MS) {
            next();
            return;
          }
          lastSessionCheckAt = Date.now();
          sessionCheckInFlight ??= isSessionActive().finally(() => {
            sessionCheckInFlight = null;
          });

          void sessionCheckInFlight
            .then((activeSession) => {
              if (activeSession) {
                next();
                return;
              }
              socket.emit("session:revoked");
              socket.disconnect(true);
              next(new Error("User session is no longer active"));
            })
            .catch((error: unknown) => {
              console.error("[Socket.IO] Session revalidation failed:", error);
              next(
                error instanceof Error
                  ? error
                  : new Error("Could not validate user session"),
              );
            });
        });
        if (socket.data.adminNotificationUserId === userId) {
          socket.join(`admin-notifications:${userId}`);
        }

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

        const presenceRedis = await getSocketRedisClient();
        let wasOnline = prevCount > 0;
        if (presenceRedis) {
          const now = Date.now();
          const existingExpiry = await presenceRedis.zscore(
            onlineUsersKey,
            userId,
          );
          wasOnline = existingExpiry !== null && Number(existingExpiry) > now;
          if (!wasOnline) await presenceRedis.zrem(onlineUsersKey, userId);
          const expiresAt = now + PRESENCE_TTL_MS;
          await Promise.all([
            presenceRedis.zadd(userSocketsKey(userId), expiresAt, socket.id),
            presenceRedis.zadd(onlineUsersKey, expiresAt, userId),
          ]);
        }

        socket.emit("users:online", await getOnlineUserIds());
        if (!wasOnline) io.except(socket.id).emit("user:online", { userId });

        const presenceHeartbeat = presenceRedis
          ? setInterval(() => {
              const expiresAt = Date.now() + PRESENCE_TTL_MS;
              void Promise.all([
                presenceRedis.zadd(
                  userSocketsKey(userId),
                  expiresAt,
                  socket.id,
                ),
                presenceRedis.zadd(onlineUsersKey, expiresAt, userId),
              ]).catch((error) =>
                console.error("[Socket.IO] Presence heartbeat failed:", error),
              );
            }, PRESENCE_HEARTBEAT_MS)
          : null;
        presenceHeartbeat?.unref();

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
            const senderId = String(message.from);
            const recipientId = String(message.to);

            if (
              (status === "sent" && senderId !== currentUserId) ||
              (status !== "sent" && recipientId !== currentUserId)
            ) {
              return cb?.({ ok: false, error: "Forbidden" });
            }

            const transitionFrom =
              status === "seen"
                ? ["sent", "delivered", null]
                : status === "delivered"
                  ? ["sent", null]
                  : ["sent", null];
            const updatedMessage = await Message.findOneAndUpdate(
              { _id: id, status: { $in: transitionFrom } },
              { $set: { status } },
              { new: true },
            ) ?? await Message.findById(id);

            if (!updatedMessage) {
              return cb?.({ ok: false, error: "Message not found" });
            }

            const effectiveStatus = updatedMessage.status;
            if (updatedMessage.status !== message.status) {
              await invalidateDirectMessages(senderId, recipientId);
            }
            io.to(String(updatedMessage.from)).emit("message:status:update", {
              id: updatedMessage._id.toString(),
              status: effectiveStatus,
            });

            if (String(updatedMessage.to) !== String(updatedMessage.from)) {
              io.to(String(updatedMessage.to)).emit("message:status:update", {
                id: updatedMessage._id.toString(),
                status: effectiveStatus,
              });
            }
            cb?.({ ok: true, message: updatedMessage });
          } catch (err: any) {
            cb?.({ ok: false, error: err.message || "Error updating status" });
          }
        });

        socket.on("typing:start", async (payload: { peerId?: string; groupId?: string }) => {
          try {
            const peerId = String(payload?.peerId ?? "");
            const groupId = String(payload?.groupId ?? "");

            if (groupId && Types.ObjectId.isValid(groupId)) {
              const memberIds = await getGroupMemberIds(groupId);
              if (!memberIds || memberIds.length === 0) return;
              io.to(memberIds)
                .except(userId)
                .emit("typing:start", { from: userId, groupId });
              return;
            }

            if (peerId && Types.ObjectId.isValid(peerId)) {
              socket.to(peerId).emit("typing:start", { from: userId, peerId });
            }
          } catch (error) {
            console.warn("[Socket.IO] typing:start handler error:", error instanceof Error ? error.message : error);
          }
        });

        socket.on("typing:stop", async (payload: { peerId?: string; groupId?: string }) => {
          try {
            const peerId = String(payload?.peerId ?? "");
            const groupId = String(payload?.groupId ?? "");

            if (groupId && Types.ObjectId.isValid(groupId)) {
              const memberIds = await getGroupMemberIds(groupId);
              if (!memberIds || memberIds.length === 0) return;
              io.to(memberIds)
                .except(userId)
                .emit("typing:stop", { from: userId, groupId });
              return;
            }

            if (peerId && Types.ObjectId.isValid(peerId)) {
              socket.to(peerId).emit("typing:stop", { from: userId, peerId });
            }
          } catch (error) {
            console.warn("[Socket.IO] typing:stop handler error:", error instanceof Error ? error.message : error);
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

        socket.on("disconnect", async () => {
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

          let hasConnections = (userConnections.get(userId) ?? 0) > 0;
          try {
            const presenceRedis = await getSocketRedisClient();
            if (presenceRedis) {
              if (presenceHeartbeat) clearInterval(presenceHeartbeat);
              const socketKey = userSocketsKey(userId);
              await presenceRedis.zrem(socketKey, socket.id);
              await presenceRedis.zremrangebyscore(socketKey, "-inf", Date.now());
              const remaining = await presenceRedis.zrange(
                socketKey,
                "0",
                "-1",
                "WITHSCORES",
              );
              const expiryScores = remaining
                .filter((_, index) => index % 2 === 1)
                .map(Number);
              hasConnections = expiryScores.some((expiry) => expiry > Date.now());
              if (!hasConnections) {
                await Promise.all([
                  presenceRedis.del(socketKey),
                  presenceRedis.zrem(onlineUsersKey, userId),
                ]);
              } else {
                await presenceRedis.zadd(
                  onlineUsersKey,
                  Math.max(...expiryScores),
                  userId,
                );
              }
            }
          } catch (error) {
            console.error("[Socket.IO] Failed to update shared presence:", error);
          }

          if (!hasConnections && Types.ObjectId.isValid(userId)) {
            const now = new Date();
            void User.findByIdAndUpdate(new Types.ObjectId(userId), {
              $set: { lastSeenAt: now },
            }).catch((error) =>
              console.error("[Socket.IO] Failed to persist last-seen:", error),
            );
            void redisDel(CacheKeys.lastSeenSingle(userId));
            io.emit("user:last-seen", {
              userId,
              lastSeenAt: now.toISOString(),
            });
            io.emit("user:offline", { userId });
          }
        });
      } catch (err: any) {
        socket.disconnect(true);
      }
    });

    io.on("error", () => {
      // Silent socket server error handling to avoid runtime exceptions.
    });
  }

  try {
    await ensureSocketAdapterReady();
    res.status(200).end();
  } catch (error) {
    console.error("[Socket.IO] Realtime service initialization failed:", error);
    res.status(503).json({ error: "Realtime service is unavailable" });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    await handleSocketRequest(req, res);
  } catch (error) {
    console.error("[Socket.IO] Realtime endpoint failed:", error);
    if (!res.headersSent) {
      res.status(503).json({ error: "Realtime service is unavailable" });
    }
  }
}