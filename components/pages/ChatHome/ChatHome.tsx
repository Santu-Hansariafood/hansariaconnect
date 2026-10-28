"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  X,
  Phone,
  Clock,
  Ban,
  CheckCircle,
  Users,
  Pin,
} from "lucide-react";
import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useContacts, type Contact } from "@/hooks/chathome/useContacts";
import { useChatListRealtime } from "@/hooks/chathome/useChatListRealtime";
import { useFilteredContacts, ChatFilter } from "@/hooks/chathome/useFilteredContacts";
import { useCreateContact } from "@/hooks/chathome/useCreateContact";
import { useForwardMessage } from "@/hooks/chathome/useForwardMessage";
import { useContactActions } from "@/hooks/chathome/useContactActions";
import Loading from "@/components/common/Loading/Loading";
import { useSocket } from "@/hooks/useSocket";
import { formatChatListTime } from "@/utils/time/chatTime";
import {
  EMAIL_REGEX,
  normalizeEmailInput,
  normalizeIndianMobileInput,
} from "@/utils/validation/formInputs";
import { resolveChatId } from "@/lib/chatIdentity";
import type { RowTone } from "@/components/ui/ContactCard/ContactCard";
const ContactCard = dynamic(
  () => import("@/components/ui/ContactCard/ContactCard"),
);
const SearchBar = dynamic(
  () => import("@/components/common/SearchBar/SearchBar"),
);
const ForwardModal = dynamic(
  () => import("@/components/ui/ForwardModal/ForwardModal"),
);

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

const FILTER_TABS: { key: ChatFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" },
  { key: "me", label: "Me" },
];

interface GroupContactItemProps {
  contact: Contact;
  active: boolean;
  tone: RowTone;
  onSelect: (contact: Contact) => void;
}

const GroupContactItem = React.memo(
  function GroupContactItem({
    contact,
    active,
    tone,
    onSelect,
  }: GroupContactItemProps) {
    const unread = contact.unread || 0;
    let lastText = contact.lastMessage || "No messages yet";
    if (typeof lastText !== "string") lastText = "No messages yet";
    if (lastText.length > 50) lastText = lastText.slice(0, 49) + "…";
    const when = formatChatListTime(contact.lastMessageTime);
    const memberCount = contact.memberCount || 0;

    return (
      <button
        onClick={() => onSelect(contact)}
        className={`relative w-full text-left flex items-center gap-3 px-4 py-3 transition-colors duration-150 border-b ${tone.border} ${
          active ? tone.active : tone.hover
        } active:scale-[0.995]`}
      >
        {active && (
          <span
            className="absolute left-0 top-0 h-full w-1"
            style={{ backgroundColor: tone.accent }}
          />
        )}
        <div className="relative flex-shrink-0">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm"
            style={{
              background: contact.avatar
                ? undefined
                : `linear-gradient(135deg, rgba(0,0,0,0.15), rgba(0,0,0,0.35)), ${tone.accent}`,
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
                  className={`w-3.5 h-3.5 flex-shrink-0 ${tone.muted}`}
                  fill="currentColor"
                />
              )}
              <Users className={`w-3.5 h-3.5 flex-shrink-0 ${tone.muted}`} />
              <p className={`font-semibold text-[16px] truncate ${tone.text}`}>
                {contact.name || "Group"}
              </p>
            </div>
            <p className={`text-[14px] truncate mt-0.5 ${
              unread > 0 ? `font-medium ${tone.text}` : tone.muted
            }`}>
              {memberCount
                ? `${memberCount} member${memberCount > 1 ? "s" : ""} · `
                : ""}
              {lastText}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            {when && (
              <span
                className={`text-[12px] ${
                  unread > 0 ? "font-medium" : tone.muted
                }`}
                style={unread > 0 ? { color: tone.accent } : undefined}
              >
                {when}
              </span>
            )}
            {unread > 0 && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold text-white"
                style={{ backgroundColor: tone.accent }}
              >
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
    prev.tone === next.tone,
);

interface ChatHomeProps {
  user: User;
  theme: Theme;
  selectedChatId?: string;
  onSelectChat?: (chatId: string) => void;
}

export default function ChatHome({
  user,
  theme,
  selectedChatId,
  onSelectChat,
}: ChatHomeProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ChatFilter>("all");

  const { contacts, loading, setContacts, refreshContacts } = useContacts(user.id);
  const { socket, addListener, removeListener } = useSocket({ subscribeOnline: false });
  const filteredContacts = useFilteredContacts({ contacts, searchQuery, filter: activeFilter });

  useChatListRealtime({
    userId: user.id,
    selectedChatId,
    socket,
    setContacts,
    refreshContacts,
    addListener,
    removeListener,
  });

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

  const clearUnread = useCallback((chatId: string) => {
    setContacts((previous) =>
      previous.map((contact) => {
        const contactId = resolveChatId(contact);
        if (contactId !== chatId || !contact.unread) return contact;
        return { ...contact, unread: 0 };
      }),
    );
  }, [setContacts]);

  const handleContactCardClick = useCallback((contact: Contact) => {
    const chatId = resolveChatId(contact);
    if (onSelectChatRef.current && contact.registeredUserId) {
      clearUnread(chatId);
      onSelectChatRef.current(chatId);
    } else {
      handleContactClickRef.current(contact);
    }
  }, [clearUnread]);

  const handleGroupClick = useCallback((contact: Contact) => {
    const chatId = resolveChatId(contact);
    clearUnread(chatId);
    if (onSelectChatRef.current) onSelectChatRef.current(chatId);
    else router.push(`/chat/${chatId}`);
  }, [clearUnread, router]);

  const noopEdit = useCallback(() => {}, []);
  const noopDelete = useCallback(() => {}, []);

  const themeColors = useMemo(
    () => ({
      textColor: theme.isDark ? "text-gray-100" : "text-gray-900",
      textSecondary: theme.isDark ? "text-gray-300" : "text-gray-600",
      textMuted: theme.isDark ? "text-gray-400" : "text-gray-500",
      bgCard: theme.isDark ? "bg-gray-800" : "bg-white",
      bgCardHover: theme.isDark ? "hover:bg-gray-700" : "hover:bg-gray-50",
      borderColor: theme.isDark ? "border-gray-700" : "border-gray-200",
      inputBg: theme.isDark
        ? "bg-gray-800 border-gray-600 focus:border-blue-400"
        : "bg-white border-gray-200 focus:border-emerald-500",
      listSurface: theme.isDark ? "bg-gray-900" : "bg-white",
      rowHover: theme.isDark ? "hover:bg-gray-800" : "hover:bg-[#f5f6f6]",
      rowActive: theme.isDark ? "bg-gray-800" : "bg-[#f0f2f5]",
      rowBorder: theme.isDark ? "border-gray-800" : "border-[#e9edef]",
      dotRing: theme.isDark ? "border-gray-900" : "border-white",
    }),
    [theme.isDark],
  );

  const {
    textColor,
    textSecondary,
    textMuted,
    bgCard,
    bgCardHover,
    borderColor,
    inputBg,
    listSurface,
    rowHover,
    rowActive,
    rowBorder,
    dotRing,
  } = themeColors;

  // Shared visual tokens for both DM and group rows so the list stays uniform.
  const rowTone = useMemo<RowTone>(
    () => ({
      accent: theme.primary,
      text: textColor,
      muted: textMuted,
      active: rowActive,
      hover: rowHover,
      border: rowBorder,
      surface: dotRing,
    }),
    [theme.primary, textColor, textMuted, rowActive, rowHover, rowBorder, dotRing],
  );

  const isInitialLoading = loading && contacts.length === 0;

  if (isInitialLoading) {
    const skeletonBlock = theme.isDark ? "bg-white/10" : "bg-black/5";

    return (
      <div
        className={`flex h-full min-h-0 flex-col overflow-hidden min-w-0 ${listSurface}`}
      >
        <div className={`shrink-0 border-b px-3 py-2 sm:px-4 ${rowBorder}`}>
          <div className="mb-2 flex items-center justify-between px-1">
            <div className={`h-6 w-20 rounded-full animate-pulse ${skeletonBlock}`} />
            <div className={`h-9 w-9 rounded-full animate-pulse ${skeletonBlock}`} />
          </div>
          <div className={`h-10 rounded-lg animate-pulse ${skeletonBlock}`} />
          <div className="mt-3 flex items-center gap-2 px-1 pb-1">
            {[64, 72, 68, 48].map((width, index) => (
              <div
                key={index}
                style={{ width }}
                className={`h-[30px] rounded-full animate-pulse ${skeletonBlock}`}
              />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className={`flex items-center gap-3 border-b px-4 py-3 ${rowBorder}`}
            >
              <div className={`h-12 w-12 shrink-0 rounded-full animate-pulse ${skeletonBlock}`} />
              <div className="min-w-0 flex-1 space-y-2">
                <div className={`h-3.5 w-1/3 rounded-full animate-pulse ${skeletonBlock}`} />
                <div className={`h-3 w-2/3 rounded-full animate-pulse ${skeletonBlock}`} />
              </div>
              <div className={`h-3 w-8 shrink-0 rounded-full animate-pulse ${skeletonBlock}`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div
        className={`flex h-full min-h-0 flex-col overflow-hidden min-w-0 ${listSurface}`}
      >
        <div className="scroll-pane flex-1 overflow-y-auto min-h-0">
          <div
            className={`sticky top-0 z-20 border-b px-3 py-2 backdrop-blur sm:px-4 ${listSurface} ${rowBorder}`}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h1 className={`text-xl font-semibold ${textColor}`}>Chats</h1>
              <button
                onClick={() => setShowCreateModal(true)}
                style={{ backgroundColor: theme.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95"
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
                accentColor={theme.primary}
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
                      : `${textMuted} ${
                          theme.isDark ? "hover:bg-white/10" : "hover:bg-black/5"
                        }`
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
          <div className="chat-list flex flex-col">
            {filteredContacts.map((contact) => {
              const chatId = resolveChatId(contact);
              const isActive = selectedChatId === chatId;

              if (contact.isGroup) {
                return (
                  <GroupContactItem
                    key={contact.id}
                    contact={contact}
                    active={isActive}
                    tone={rowTone}
                    onSelect={handleGroupClick}
                  />
                );
              }

              return (
                <div key={contact.id}>
                  <ContactCard
                    contact={contact}
                    onSelect={handleContactCardClick}
                    onPin={handlePinContact}
                    onUnpin={handleUnpinContact}
                    onForward={handleForwardMessage}
                    onEdit={noopEdit}
                    onDelete={noopDelete}
                    theme={theme}
                    tone={rowTone}
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
                      const peer = selectedContact.registeredUserId;
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
                      maxLength={80}
                      autoComplete="name"
                      required
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
                              updateMobileField(
                                idx,
                                normalizeIndianMobileInput(e.target.value),
                              )
                            }
                            inputMode="numeric"
                            autoComplete="tel-national"
                            className={`flex-1 px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                            placeholder="10-digit number"
                            maxLength={10}
                            pattern="[6-9][0-9]{9}"
                            title="Enter a 10-digit Indian mobile number starting with 6, 7, 8, or 9"
                            required={idx === 0}
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
                      onChange={(e) =>
                        setNewEmail(normalizeEmailInput(e.target.value))
                      }
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      autoComplete="email"
                      pattern={EMAIL_REGEX.source}
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
