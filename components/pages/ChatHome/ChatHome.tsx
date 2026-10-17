"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { format } from "date-fns";
import {
  X,
  Phone,
  Clock,
  Ban,
  CheckCircle,
  MessageSquarePlus,
  Users,
  MoreVertical,
  LogOut,
  CircleUserRound,
  Pin,
} from "lucide-react";
import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useContacts } from "@/hooks/chathome/useContacts";
import { useFilteredContacts, ChatFilter } from "@/hooks/chathome/useFilteredContacts";
import { useCreateContact } from "@/hooks/chathome/useCreateContact";
import { useForwardMessage } from "@/hooks/chathome/useForwardMessage";
import { useContactActions } from "@/hooks/chathome/useContactActions";
import { useNavbarUser } from "@/hooks/navbar/useNavbarUser";
import Loading from "@/components/common/Loading/Loading";
import { useSocket } from "@/hooks/useSocket";
const ContactCard = dynamic(
  () => import("@/components/ui/ContactCard/ContactCard"),
);
const SearchBar = dynamic(
  () => import("@/components/common/SearchBar/SearchBar"),
);
const ForwardModal = dynamic(
  () => import("@/components/ui/ForwardModal/ForwardModal"),
);

export interface Contact {
  id: string;
  peerId?: string;
  name: string;
  mobile: string;
  avatar: string;
  pinned: boolean;
  blocked?: boolean;
  active: boolean;
  unread: number;
  lastSeen?: string;
  lastMessageTime: string;
  lastMessage: string;
  mobiles?: string[];
  email?: string;
  registered?: boolean;
  registeredUserId?: string;
  isGroup?: boolean;
  memberCount?: number;
  lastMessageFromMe?: boolean;
}

interface Theme {
  wallpaper?: string;
  textSize?: string;
  primary: string;
  secondary?: string;
  isDark?: boolean;
}

interface User {
  id?: string | number;
  name?: string;
  photo?: string;
  avatar?: string;
  email?: string;
  mobile?: string;
  step?: string;
}

const getMessagePreview = (message: any): string => {
  if (message?.type === "image") return "📷 Image";
  if (message?.type === "video") return "🎥 Video";
  if (message?.type === "voice") return "🎤 Voice";
  if (message?.type === "pdf") return "📄 PDF";
  if (message?.type === "excel") return "📊 Excel";
  if (message?.type === "link") return message?.linkTitle || "🔗 Link";
  return message?.text || "New message";
};

const FILTER_TABS: { key: ChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" },
  { key: "me", label: "Me" },
];

interface GroupContactItemProps {
  contact: Contact;
  active: boolean;
  primaryColor: string;
  textMuted: string;
  textColor: string;
  onClick: () => void;
}

const GroupContactItem = React.memo(
  function GroupContactItem({
    contact,
    active,
    primaryColor,
    textMuted,
    textColor,
    onClick,
  }: GroupContactItemProps) {
    const unread = contact.unread || 0;
    let lastText = contact.lastMessage || "No messages yet";
    if (typeof lastText !== "string") lastText = "No messages yet";
    if (lastText.length > 50) lastText = lastText.slice(0, 49) + "…";
    let when = "";
    try {
      const d = new Date(contact.lastMessageTime || Date.now());
      if (!isNaN(d.getTime())) when = format(d, "h:mm a").toLowerCase();
    } catch {}
    const memberCount = contact.memberCount || 0;

    return (
      <button
        onClick={onClick}
        className={`relative w-full text-left flex items-center gap-3 px-4 py-3 transition-colors duration-150 border-b border-[#e9edef] ${
          active ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
        } active:scale-[0.995]`}
      >
        {active && (
          <span className="absolute left-0 top-0 h-full w-1 bg-[#00a884]" />
        )}
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm"
            style={{
              background: contact.avatar
                ? undefined
                : "linear-gradient(135deg, #00a884 0%, #008069 100%)",
            }}
          >
            {contact.avatar ? (
              <Image
                src={contact.avatar}
                alt={contact.name || "Group"}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Users className="w-5 h-5 text-white" />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {contact.pinned && (
                <Pin
                  className="w-3.5 h-3.5 flex-shrink-0 text-[#667781]"
                  fill="currentColor"
                />
              )}
              <Users className={`w-3.5 h-3.5 flex-shrink-0 ${textMuted}`} />
              <p className={`font-semibold text-[15.5px] truncate ${textColor}`}>
                {contact.name || "Group"}
              </p>
            </div>
            <p className={`text-[13.5px] truncate mt-0.5 ${textMuted}`}>
              {memberCount
                ? `${memberCount} member${memberCount > 1 ? "s" : ""} · `
                : ""}
              {lastText}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {when && (
              <span
                className={`text-[11px] ${
                  unread > 0 ? "font-medium text-[#0a9488]" : textMuted
                }`}
              >
                {when}
              </span>
            )}
            {unread > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[11px] font-semibold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  },
  (prev, next) =>
    prev.contact.id === next.contact.id &&
    prev.contact.name === next.contact.name &&
    prev.contact.avatar === next.contact.avatar &&
    prev.contact.unread === next.contact.unread &&
    prev.contact.pinned === next.contact.pinned &&
    prev.contact.lastMessage === next.contact.lastMessage &&
    prev.contact.lastMessageTime === next.contact.lastMessageTime &&
    prev.contact.memberCount === next.contact.memberCount &&
    prev.active === next.active &&
    prev.primaryColor === next.primaryColor,
);

interface ChatHomeProps {
  user: User;
  theme: Theme;
  onLogout: () => void;
  selectedChatId?: string;
  onSelectChat?: (chatId: string) => void;
}

export default function ChatHome({
  user,
  theme,
  onLogout,
  selectedChatId,
  onSelectChat,
}: ChatHomeProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");

  const profileUser = useNavbarUser(user);
  const { contacts, loading, setContacts, refreshContacts } = useContacts(user.id);
  const { socket, addListener, removeListener } = useSocket({ subscribeOnline: false });
  const filteredContacts = useFilteredContacts({ contacts, searchQuery, filter: activeFilter });

  // Refs avoid re-subscribing socket listeners whenever selectedChatId or user changes
  const selectedChatIdRef = useRef<string | undefined>(selectedChatId);
  const userIdRef = useRef<string>(String(user.id || ""));
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);
  useEffect(() => {
    userIdRef.current = String(user.id || "");
  }, [user.id]);

  // Stable socket reference for handlers
  const socketRef = useRef(socket);
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const handleIncomingMessage = (message: any) => {
      const fromId = String(message?.from || "");
      const toId = String(message?.to || "");
      const myId = userIdRef.current;

      if (!fromId || !toId) return;

      const isFromMe = fromId === myId;
      const peerId = isFromMe ? toId : fromId;

      if (!peerId || peerId === myId) return;

      const recipientId = toId;
      const messageId = String(message?._id || message?.id || "");
      if (
        !isFromMe &&
        recipientId === myId &&
        /^[0-9a-f]{24}$/i.test(messageId)
      ) {
        socketRef.current?.emit(
          "message:status",
          { id: messageId, status: "delivered" },
          (ack: { ok?: boolean; error?: string }) => {
            if (!ack?.ok) {
              console.warn(
                "[ChatHome] Could not confirm message delivery:",
                ack?.error || "Unknown status error",
              );
            }
          },
        );
      }

      console.log(
        "[ChatHome] Direct message arrived via socket — updating peer",
        peerId,
        isFromMe ? "(sent by me)" : "(incoming)",
      );

      let foundPeer = false;
      setContacts((previous) =>
        previous.map((contact) => {
          const contactPeerId = String(
            contact.registeredUserId || contact.peerId || contact.id || "",
          );
          if (contactPeerId !== peerId) return contact;
          foundPeer = true;

          return {
            ...contact,
            lastMessage: getMessagePreview(message),
            lastMessageTime:
              message?.createdAt || message?.timestamp || new Date().toISOString(),
            lastMessageFromMe: isFromMe,
            unread:
              isFromMe || selectedChatIdRef.current === peerId
                ? 0
                : Number(contact.unread || 0) + 1,
          };
        }),
      );

      if (!foundPeer) {
        console.log(
          "[ChatHome] Incoming direct message belongs to a peer outside the local list. Refreshing conversations.",
          peerId,
        );
        void refreshContacts();
      }
    };

    const handleIncomingGroupMessage = (message: any) => {
      const groupId = String(message?.groupId || "");
      const fromId = String(message?.from || "");
      const myId = userIdRef.current;
      if (!groupId) return;

      const isFromMe = fromId === myId;

      console.log(
        "[ChatHome] Group message arrived via socket — updating group",
        groupId,
        "| from:",
        fromId,
        isFromMe ? "(sent by me)" : "(incoming)",
      );

      let foundGroup = false;
      setContacts((previous) =>
        previous.map((contact) => {
          const contactId = String(
            contact.registeredUserId || contact.peerId || contact.id || "",
          );
          if (contactId !== groupId || !contact.isGroup) return contact;
          foundGroup = true;
          return {
            ...contact,
            lastMessage: getMessagePreview(message),
            lastMessageTime:
              message?.createdAt || message?.timestamp || new Date().toISOString(),
            lastMessageFromMe: isFromMe,
            unread:
              isFromMe || selectedChatIdRef.current === groupId
                ? 0
                : Number(contact.unread || 0) + 1,
          };
        }),
      );

      if (!foundGroup) {
        console.log(
          "[ChatHome] Incoming group message belongs to a group outside the local list. Refreshing conversations.",
          groupId,
        );
        void refreshContacts();
      }
    };

    const handleUnreadUpdate = (payload: {
      conversations?: Record<string, number>;
      groups?: Record<string, number>;
    }) => {
      if (!payload || typeof payload !== "object") return;
      const mergedUnread: Record<string, number> = {
        ...(payload.conversations || {}),
        ...(payload.groups || {}),
      };
      setContacts((previous) =>
        previous.map((contact) => {
          const peerId = String(
            contact.registeredUserId || contact.peerId || contact.id || "",
          );
          const unread = Number(mergedUnread[peerId] || 0);
          return contact.unread === unread ? contact : { ...contact, unread };
        }),
      );
    };

    addListener("message:new", handleIncomingMessage);
    addListener("group:message:new", handleIncomingGroupMessage);
    addListener("unread:update", handleUnreadUpdate);

    return () => {
      removeListener("message:new", handleIncomingMessage);
      removeListener("group:message:new", handleIncomingGroupMessage);
      removeListener("unread:update", handleUnreadUpdate);
    };
  }, [
    addListener,
    refreshContacts,
    removeListener,
    setContacts,
    socket,
  ]);

  const handleSearch = useCallback(
    (query: string) => setSearchQuery(query),
    [],
  );

  const {
    showCreateModal,
    setShowCreateModal,
    newName,
    setNewName,
    newMobiles,
    newEmail,
    setNewEmail,
    createError,
    creating,
    addMobileField,
    updateMobileField,
    removeMobileField,
    submitCreateContact,
  } = useCreateContact({ setContacts });

  const { forwardModalData, handleForwardMessage, handleForwardSubmit } =
    useForwardMessage({ contacts });

  const {
    selectedContact,
    showContactModal,
    handleContactClick,
    handlePinContact,
    handleUnpinContact,
    handleBlockUnblock,
    closeContactModal,
  } = useContactActions({ contacts, setContacts });

  // Stable callbacks for list items — refs keep them fresh without re-creating
  const onSelectChatRef = useRef(onSelectChat);
  const handleContactClickRef = useRef(handleContactClick);
  useEffect(() => {
    onSelectChatRef.current = onSelectChat;
  }, [onSelectChat]);
  useEffect(() => {
    handleContactClickRef.current = handleContactClick;
  }, [handleContactClick]);

  const handleContactCardClick = useCallback((contact: Contact) => {
    const chatId = contact.peerId || contact.registeredUserId || contact.id;
    if (onSelectChatRef.current && contact.registeredUserId) {
      onSelectChatRef.current(chatId);
    } else {
      handleContactClickRef.current(contact);
    }
  }, []);

  const handleGroupClick = useCallback((contact: Contact) => {
    const chatId = contact.peerId || contact.registeredUserId || contact.id;
    if (onSelectChatRef.current) onSelectChatRef.current(chatId);
    else router.push(`/chat/${chatId}`);
  }, [router]);

  const noopEdit = useCallback(() => {}, []);
  const noopDelete = useCallback(() => {}, []);

  const themeColors = useMemo(
    () => ({
      textColor: theme.isDark ? "text-gray-100" : "text-gray-800",
      textSecondary: theme.isDark ? "text-gray-300" : "text-gray-600",
      textMuted: theme.isDark ? "text-gray-400" : "text-gray-500",
      bgCard: theme.isDark ? "bg-gray-800" : "bg-white",
      bgCardHover: theme.isDark ? "hover:bg-gray-700" : "hover:bg-gray-50",
      bgOverlay: theme.isDark ? "bg-gray-900/80" : "bg-black/50",
      borderColor: theme.isDark ? "border-gray-700" : "border-gray-200",
      inputBg: theme.isDark
        ? "bg-gray-800 border-gray-600 focus:border-blue-400"
        : "bg-white border-gray-200 focus:border-emerald-500",
    }),
    [theme.isDark],
  );

  const {
    textColor,
    textSecondary,
    textMuted,
    bgCard,
    bgCardHover,
    bgOverlay,
    borderColor,
    inputBg,
  } = themeColors;

  const isInitialLoading = loading && contacts.length === 0;

  if (isInitialLoading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f0f2f5] min-w-0">
        <div
          className="h-14 sm:h-[60px] min-h-[56px] px-3 sm:px-4 flex items-center justify-between relative z-20 shadow-sm"
          style={{ backgroundColor: theme.primary }}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/20 animate-pulse" />
            <div className="h-4 w-24 rounded-full bg-white/20 animate-pulse" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
            <div className="h-8 w-8 rounded-full bg-white/20 animate-pulse" />
          </div>
        </div>

        <div className="flex-1 space-y-3 p-3">
          <div className="h-12 rounded-2xl bg-white/60 animate-pulse" />
          {[...Array(4)].map((_, index) => (
            <div key={index} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3 animate-pulse">
              <div className="h-12 w-12 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-28 rounded-full bg-gray-200" />
                <div className="h-3 w-36 rounded-full bg-gray-200" />
              </div>
              <div className="h-3 w-8 rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f0f2f5] min-w-0">
        <div
          className="h-14 sm:h-[60px] min-h-[56px] px-3 sm:px-4 flex items-center justify-between relative z-20 shadow-sm"
          style={{ backgroundColor: theme.primary }}
        >
          <button
            onClick={() => router.push("/profile")}
            className="flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform duration-150"
            title="Profile"
          >
            <div className="relative">
              {profileUser.photo || user?.photo || user?.avatar ? (
                <Image
                  src={profileUser.photo || user.photo || user.avatar || "/logo/logo.png"}
                  alt={profileUser.name || user.name || "User"}
                  width={40}
                  height={40}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-2 ring-white/20"
                />
              ) : (
                <div
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm ring-2 ring-white/20"
                  style={{
                    background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primary}cc 100%)`,
                  }}
                >
                  {(profileUser.name || user?.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 transition-colors duration-200 ${
                  socket?.connected ? "bg-green-500" : "bg-gray-400"
                }`}
                style={{ borderColor: theme.primary }}
              />
            </div>
          </button>

          <div className="flex items-center gap-1 sm:gap-2 text-white">
            <button
              onClick={() => router.push("/status")}
              className="p-2 rounded-full hover:bg-white/10 transition-colors duration-150 active:scale-90"
              title="Status"
            >
              <CircleUserRound className="w-5 h-5" />
            </button>

            <button
              onClick={() => router.push("/groups")}
              className="p-2 rounded-full hover:bg-white/10 transition-colors duration-150 active:scale-90"
              title="Groups"
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors duration-150 active:scale-90"
              title="New Chat"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors duration-150 active:scale-90"
                title="Menu"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-1 w-48 rounded-lg bg-white shadow-xl border border-gray-200 py-1 z-40 overflow-hidden">
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/profile");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-3"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/contacts");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-3"
                    >
                      Contacts
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/status");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 transition-colors flex items-center gap-3"
                    >
                      Status
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout?.();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 scroll-smooth">
          <div className="bg-[#f0f2f5] px-3 py-2 border-b border-[#e9edef]">
            <div className="mb-2 flex items-center justify-between px-1">
              <h1 className="text-xl font-semibold text-[#111b21]">Chats</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{ backgroundColor: theme.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm hover:opacity-90 transition-opacity duration-150 active:scale-95"
                title="New Contact"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
            <div className="px-1">
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search or start new chat..."
              />
            </div>
            <div className="mt-2 flex items-center gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex-shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 active:scale-95 ${
                    activeFilter === tab.key
                      ? "text-white shadow-sm"
                      : "text-[#54656f] hover:bg-black/5"
                  }`}
                  style={
                    activeFilter === tab.key
                      ? { backgroundColor: theme.primary }
                      : undefined
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col">
            {filteredContacts.map((contact) => {
              const chatId =
                contact.peerId || contact.registeredUserId || contact.id;
              const isActive = selectedChatId === chatId;

              if (contact.isGroup) {
                return (
                  <GroupContactItem
                    key={contact.id}
                    contact={contact}
                    active={isActive}
                    primaryColor={theme.primary}
                    textMuted={textMuted}
                    textColor={textColor}
                    onClick={() => handleGroupClick(contact)}
                  />
                );
              }

              return (
                <div key={contact.id}>
                  <ContactCard
                    contact={contact}
                    onClick={() => handleContactCardClick(contact)}
                    onPin={handlePinContact}
                    onUnpin={handleUnpinContact}
                    onForward={handleForwardMessage}
                    onEdit={noopEdit}
                    onDelete={noopDelete}
                    theme={theme}
                    active={isActive}
                  />
                </div>
              );
            })}
          </div>
          {filteredContacts.length === 0 && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <p className={`text-sm ${textMuted}`}>
                {activeFilter === "unread"
                  ? "No unread chats"
                  : activeFilter === "groups"
                    ? "No group chats"
                    : activeFilter === "me"
                      ? "No chats with your last message"
                      : "No contacts or groups found"}
              </p>
            </motion.div>
          )}
          {showContactModal && selectedContact && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-50 overflow-y-auto ${theme.isDark ? "bg-gray-900" : "bg-white"}`}
              onClick={closeContactModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className={`${bgCard} mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8`}
              >
                <div className="flex justify-between items-start mb-6">
                  <h2 className={`text-2xl font-bold ${textColor}`}>
                    Contact Info
                  </h2>
                  <button
                    onClick={closeContactModal}
                    className={`${bgCardHover} p-2 rounded-full transition-colors`}
                  >
                    <X className={`w-6 h-6 ${textSecondary}`} />
                  </button>
                </div>

                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-4">
                    <Image
                      src={selectedContact.avatar || "/logo/logo.png"}
                      alt={selectedContact.name}
                      width={128}
                      height={128}
                      className="w-32 h-32 rounded-full object-cover border-4"
                      style={{
                        borderColor:
                          theme.secondary ||
                          (theme.isDark ? "#374151" : "#e5e7eb"),
                      }}
                    />
                    {selectedContact.active && (
                      <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
                    )}
                  </div>
                  <h3 className={`text-2xl font-bold ${textColor} mb-1`}>
                    {selectedContact.name}
                  </h3>
                  <p className={`${textSecondary} flex items-center gap-2`}>
                    <Phone className={`w-4 h-4 ${textSecondary}`} />
                    {selectedContact.mobile}
                  </p>
                </div>

                <div className="space-y-4 mb-6">
                  <div
                    className={`${bgCardHover} flex items-center gap-3 p-3 rounded-xl ${borderColor}`}
                  >
                    <Clock className={`w-5 h-5 ${textMuted}`} />
                    <div>
                      <p className={`${textMuted} text-sm`}>Last Seen</p>
                      <p className={`${textColor} font-medium`}>
                        {selectedContact.lastSeen || "Never"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`${bgCardHover} flex items-center gap-3 p-3 rounded-xl ${borderColor}`}
                  >
                    <CheckCircle className={`w-5 h-5 ${textMuted}`} />
                    <div>
                      <p className={`${textMuted} text-sm`}>Status</p>
                      <p
                        className={`font-medium ${selectedContact.active ? "text-green-500" : textColor}`}
                      >
                        {selectedContact.active ? "Active" : "Inactive"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      const peer = (selectedContact as any).registeredUserId;
                      if (peer) {
                        closeContactModal();
                        if (onSelectChat) onSelectChat(peer);
                        else router.push(`/chat/${peer}`);
                        return;
                      }
                      try {
                        const mobile =
                          (Array.isArray(selectedContact.mobiles) &&
                            selectedContact.mobiles[0]) ||
                          selectedContact.mobile;
                        const res = await fetch("/api/users/by-mobile", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ mobile }),
                        });
                        const data = await res.json();
                        if (res.ok && data?.id) {
                          closeContactModal();
                          if (onSelectChat) onSelectChat(data.id);
                          else router.push(`/chat/${data.id}`);
                        } else {
                          closeContactModal();
                          alert(
                            "Unable to open chat. Please check mobile number.",
                          );
                        }
                      } catch {
                        closeContactModal();
                        alert("Unable to open chat. Please try again.");
                      }
                    }}
                    className="flex-1 py-3 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Phone className="w-5 h-5" />
                    Message
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleBlockUnblock(selectedContact.id)}
                    className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg ${
                      selectedContact.blocked
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-500 text-white hover:bg-red-600"
                    }`}
                  >
                    <Ban className="w-5 h-5" />
                    {selectedContact.blocked ? "Unblock" : "Block"}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
          {forwardModalData.visible && (
            <ForwardModal
              contacts={contacts}
              onClose={() => handleForwardSubmit([], "")}
              onForward={handleForwardSubmit}
              theme={theme}
            />
          )}
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`fixed inset-0 z-50 overflow-y-auto ${theme.isDark ? "bg-gray-900" : "bg-white"}`}
              onClick={() => setShowCreateModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
                className={`${bgCard} mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8`}
              >
                <div className="flex justify-between items-start mb-6">
                  <h2 className={`text-2xl font-bold ${textColor}`}>
                    Create Contact
                  </h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className={`${bgCardHover} p-2 rounded-full transition-colors`}
                  >
                    <X className={`w-6 h-6 ${textSecondary}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-2`}
                    >
                      Name
                    </label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className={`w-full px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                      placeholder="Enter contact name"
                    />
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-2`}
                    >
                      Mobile Numbers
                    </label>
                    <div className="space-y-2">
                      {newMobiles.map((m, idx) => (
                        <div key={idx} className="flex gap-2">
                          <input
                            type="tel"
                            value={m}
                            onChange={(e) =>
                              updateMobileField(idx, e.target.value)
                            }
                            className={`flex-1 px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                            placeholder="10-digit number"
                            maxLength={10}
                            pattern="[0-9]{10}"
                            title="Enter a valid 10-digit number"
                          />
                          {newMobiles.length > 1 && (
                            <button
                              onClick={() => removeMobileField(idx)}
                              className="px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addMobileField}
                      className={`${bgCardHover} mt-2 px-3 py-2 rounded-xl ${textSecondary} hover:opacity-80 transition-all`}
                    >
                      Add another number
                    </button>
                  </div>

                  <div>
                    <label
                      className={`block text-sm font-medium ${textSecondary} mb-2`}
                    >
                      Email
                    </label>
                    <input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className={`w-full px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                      placeholder="example@domain.com"
                    />
                  </div>

                  {createError && (
                    <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/30">
                      {createError}
                    </p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={submitCreateContact}
                      disabled={creating}
                      className="flex-1 py-3 text-white rounded-xl font-medium transition-colors shadow-lg"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {creating ? "Saving..." : "Save Contact"}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setShowCreateModal(false)}
                      className={`${bgCardHover} flex-1 py-3 rounded-xl font-medium ${textSecondary} border ${borderColor}`}
                    >
                      Cancel
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>
    </Suspense>
  );
}
