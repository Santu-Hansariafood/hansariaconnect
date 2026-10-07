"use client";

import React, { useCallback, useMemo } from "react";
import { format, isSameDay } from "date-fns";
import MessageBubble from "@/components/ui/MessageBubble/MessageBubble";
import TypingIndicator from "@/components/ui/TypingIndicator/TypingIndicator";
import { ChatMessage, GroupMember, Theme, User } from "./ChatWindowTypes";

interface ChatWindowMessageListProps {
  messages: ChatMessage[];
  theme: Theme;
  user: User;
  id: string;
  isGroup: boolean;
  headerName: string;
  headerAvatar: string;
  groupMembers: GroupMember[];
  onForwardMessage: (msg: ChatMessage) => void;
  onReaction: (msg: ChatMessage, emoji: string) => Promise<boolean>;
  showUnreadBanner: boolean;
  unreadOnOpen: number;
  unreadDividerRef: React.RefObject<HTMLDivElement | null>;
  typingUsers?: string[];
}

function toSenderId(from?: string | { toString?: () => string }) {
  if (!from) return "";
  if (typeof from === "string") return from;
  return from.toString ? from.toString() : "";
}

function toMsgKey(msg: ChatMessage): string {
  return (
    msg._id?.toString?.() ||
    msg.id?.toString?.() ||
    (msg && typeof msg === "object" && "timestamp" in msg
      ? String((msg as any).timestamp || "")
      : "") ||
    (msg && typeof msg === "object" && "createdAt" in msg
      ? String((msg as any).createdAt || "")
      : "") ||
    `${msg.from}-${msg.to}-${msg.text}-${msg.mediaUrl || ""}`
  );
}

export default function ChatWindowMessageList({
  messages,
  theme,
  user,
  id,
  isGroup,
  headerName,
  headerAvatar,
  groupMembers,
  onForwardMessage,
  onReaction,
  showUnreadBanner,
  unreadOnOpen,
  unreadDividerRef,
  typingUsers = [],
}: ChatWindowMessageListProps) {
  const currentUserId = String(user.id);

  const meta = useMemo(() => {
    let firstUnreadIndex = -1;
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      const sender = toSenderId(m.from);
      const incoming = isGroup
        ? Boolean(sender) && sender !== currentUserId
        : sender === id;
      const status = (m.status as string) || "sent";
      if (incoming && status !== "seen") {
        firstUnreadIndex = i;
        break;
      }
    }

    const dateDividersAt: boolean[] = new Array(messages.length);
    const groupMemberCache = new Map<string, {
      id: string;
      name: string;
      avatar: string;
    }>();

    return { firstUnreadIndex, dateDividersAt, groupMemberCache };
  }, [messages, id, isGroup, currentUserId]);

  const groupMemberContact = useCallback((fromStr: string) => {
    const cached = meta.groupMemberCache.get(fromStr);
    if (cached !== undefined) return cached;
    let resolved: { id: string; name: string; avatar: string } | null = null;
    if (isGroup && fromStr) {
      const member = groupMembers.find(
        (memberItem) => String(memberItem.id) === String(fromStr),
      );
      if (member) {
        resolved = {
          id: member.id,
          name: member.name,
          avatar: member.avatar || "/logo/logo.png",
        };
      }
    }
    if (!resolved) {
      resolved = { id, name: headerName, avatar: headerAvatar };
    }
    meta.groupMemberCache.set(fromStr, resolved);
    return resolved;
  }, [groupMembers, headerAvatar, headerName, id, isGroup, meta.groupMemberCache]);

  return (
    <div className="w-full mx-auto space-y-1.5 w-full min-w-0">
      {messages.length === 0 && (
        <div className="text-center text-gray-600 py-6">
          <p className="text-sm">
            {isGroup
              ? `No messages in ${headerName}. Start the conversation!`
              : `New chat with ${headerName}. Start typing or send media.`}
          </p>
        </div>
      )}

      {showUnreadBanner && unreadOnOpen > 0 && (
        <div className="sticky top-0 z-10">
          <div className="px-3 py-2 bg-yellow-100 text-yellow-800 rounded-xl text-sm font-medium shadow">
            {unreadOnOpen} unread message{unreadOnOpen > 1 ? "s" : ""}
          </div>
        </div>
      )}

      {messages.map((msg, idx, arr) => {
        const fromStr = toSenderId(msg.from);
        const isIncoming = isGroup
          ? Boolean(fromStr) && fromStr !== currentUserId
          : fromStr === id;

        const currentDate = new Date(
          msg.timestamp || msg.createdAt || Date.now(),
        );
        const prevMsg = idx > 0 ? arr[idx - 1] : null;
        const prevDate = prevMsg
          ? new Date(prevMsg.timestamp || prevMsg.createdAt || Date.now())
          : null;
        const showDateDivider = !prevDate || !isSameDay(currentDate, prevDate);

        const bubbleContact = groupMemberContact(fromStr);
        const stableKey = toMsgKey(msg);

        return (
          <React.Fragment key={stableKey}>
            {showDateDivider && (
              <div className="flex justify-center my-4">
                <span className="text-xs px-4 py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
                  {format(currentDate, "MMMM d, yyyy")}
                </span>
              </div>
            )}

            {idx === meta.firstUnreadIndex && meta.firstUnreadIndex >= 0 && (
              <div className="flex justify-center my-2" ref={unreadDividerRef}>
                <span className="text-xs px-3 py-1 bg-yellow-200 rounded-full text-yellow-800 font-medium">
                  Unread messages
                </span>
              </div>
            )}

            <MessageBubble
              message={{
                sender: isIncoming ? "contact" : "me",
                type: msg.type || "text",
                text: msg.text,
                media: msg.mediaUrl,
                url: msg.mediaUrl || undefined,
                timestamp:
                  msg.timestamp || msg.createdAt || new Date().toISOString(),
                status: msg.status || "sent",
                duration: msg.duration,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                linkTitle: msg.linkTitle,
                linkDescription: msg.linkDescription,
                reactions: msg.reactions,
              }}
              user={user}
              contact={bubbleContact}
              theme={theme}
              isGroup={isGroup}
              onForward={() => onForwardMessage(msg)}
              onReaction={(emoji) => onReaction(msg, emoji)}
            />
          </React.Fragment>
        );
      })}

      {typingUsers.length > 0 && (
        <TypingIndicator typingUsers={typingUsers} isGroup={isGroup} />
      )}

      <div ref={unreadDividerRef} />
    </div>
  );
}
