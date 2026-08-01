"use client";

import React from "react";
import { format, isSameDay } from "date-fns";
import MessageBubble from "@/components/ui/MessageBubble/MessageBubble";
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
  showUnreadBanner: boolean;
  unreadOnOpen: number;
  unreadDividerRef: React.RefObject<HTMLDivElement | null>;
}

function toSenderId(from?: string | { toString?: () => string }) {
  if (!from) return "";
  if (typeof from === "string") return from;
  return from.toString ? from.toString() : "";
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
  showUnreadBanner,
  unreadOnOpen,
  unreadDividerRef,
}: ChatWindowMessageListProps) {
  const renderMessages = messages;

  return (
    <div className="max-w-4xl mx-auto space-y-1.5 w-full min-w-0">
      {renderMessages.length === 0 && (
        <div className="text-center text-gray-600 py-6">
          <p className="text-sm">
            {isGroup ? `No messages in ${headerName}. Start the conversation!` : `New chat with ${headerName}. Start typing or send media.`}
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

      {renderMessages.map((msg, idx, arr) => {
        const fromStr = toSenderId(msg.from);
        const isIncoming = fromStr === id;

        const currentDate = new Date(msg.timestamp || msg.createdAt || Date.now());
        const prevMsg = idx > 0 ? arr[idx - 1] : null;
        const prevDate = prevMsg ? new Date(prevMsg.timestamp || prevMsg.createdAt || Date.now()) : null;
        const showDateDivider = !prevDate || !isSameDay(currentDate, prevDate);

        const firstUnread = arr.findIndex((m) => {
          const sender = toSenderId(m.from);
          return sender === id && (m.status || "sent") !== "seen";
        });

        const bubbleContact = (() => {
          if (isGroup && isIncoming) {
            const senderId = fromStr;
            const member = groupMembers.find((memberItem) => String(memberItem.id) === String(senderId));
            if (member) {
              return { id: member.id, name: member.name, avatar: member.avatar || "/logo/logo.png" };
            }
          }
          return { id, name: headerName, avatar: headerAvatar };
        })();

        return (
          <React.Fragment
            key={msg._id?.toString() || `${fromStr}-${msg.to || ""}-${msg.createdAt || msg.timestamp}-${msg.mediaUrl || msg.text || ""}`}
          >
            {showDateDivider && (
              <div className="flex justify-center my-4">
                <span className="text-xs px-4 py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
                  {format(currentDate, "MMMM d, yyyy")}
                </span>
              </div>
            )}

            {idx === firstUnread && firstUnread >= 0 && (
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
                timestamp: msg.timestamp || msg.createdAt || new Date().toISOString(),
                status: msg.status || "sent",
                duration: msg.duration,
                fileName: msg.fileName,
                fileSize: msg.fileSize,
                linkTitle: msg.linkTitle,
                linkDescription: msg.linkDescription,
              }}
              user={user}
              contact={bubbleContact}
              theme={theme}
              isGroup={isGroup}
              onForward={() => onForwardMessage(msg)}
            />
          </React.Fragment>
        );
      })}

      <div ref={unreadDividerRef} />
    </div>
  );
}
