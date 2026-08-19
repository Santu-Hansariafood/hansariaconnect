"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
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
} from "lucide-react";
import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { staggerContainer, fadeIn } from "@/utils/animations/animations";
import { useContacts } from "@/hooks/chathome/useContacts";
import { useFilteredContacts } from "@/hooks/chathome/useFilteredContacts";
import { useCreateContact } from "@/hooks/chathome/useCreateContact";
import { useForwardMessage } from "@/hooks/chathome/useForwardMessage";
import { useContactActions } from "@/hooks/chathome/useContactActions";
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
  const [groups, setGroups] = useState<any[]>([]);

  const { contacts, loading, setContacts } = useContacts(user.id);
  const { socket } = useSocket();
  const filteredContacts = useFilteredContacts({ contacts, searchQuery });

  useEffect(() => {
    let cancelled = false;
    const loadGroups = async () => {
      try {
        const res = await fetch("/api/groups", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await res.json();
        if (!cancelled && res.ok && Array.isArray(data?.groups)) {
          setGroups(data.groups);
        }
      } catch {}
    };

    loadGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = useCallback(
    (query: string) => setSearchQuery(query),
    [],
  );

  const visibleGroups = useMemo(() => {
    const q = (searchQuery || "").trim().toLowerCase();
    return q
      ? groups.filter((g: any) => (g?.name || "").toLowerCase().includes(q))
      : groups;
  }, [groups, searchQuery]);

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
  } = useCreateContact({ contacts, setContacts });

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
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push("/profile")}
            className="flex items-center justify-center flex-shrink-0"
            title="Profile"
          >
            <div className="relative">
              {user?.photo || user?.avatar ? (
                <Image
                  src={user.photo || user.avatar || "/logo/logo.png"}
                  alt={user.name || "User"}
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
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${
                  socket?.connected ? "bg-green-500" : "bg-gray-400"
                }`}
                style={{ borderColor: theme.primary }}
              />
            </div>
          </motion.button>

          <div className="flex items-center gap-1 sm:gap-2 text-white">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push("/status")}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Status"
            >
              <CircleUserRound className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => router.push("/groups")}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="Groups"
            >
              <Users className="w-5 h-5" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowCreateModal(true)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              title="New Chat"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </motion.button>

            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setMenuOpen((v) => !v)}
                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                title="Menu"
              >
                <MoreVertical className="w-5 h-5" />
              </motion.button>
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
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 flex items-center gap-3"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/contacts");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 flex items-center gap-3"
                    >
                      Contacts
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/status");
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-800 hover:bg-gray-100 flex items-center gap-3"
                    >
                      Status
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout?.();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
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

        <div className="flex-1 overflow-y-auto min-h-0">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#f0f2f5] px-3 py-2 shadow-[inset_0_-1px_0_#e9edef]"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <h1 className="text-xl font-semibold text-[#111b21]">Chats</h1>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowCreateModal(true)}
                style={{ backgroundColor: theme.primary }}
                className="flex h-9 w-9 items-center justify-center rounded-full text-white shadow-sm"
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
              </motion.button>
            </div>
            <div className="px-1">
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search or start new chat..."
              />
            </div>
          </motion.div>
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="flex flex-col"
          >
            {filteredContacts.map((contact) => (
              <motion.div key={contact.id} {...fadeIn}>
                <ContactCard
                  contact={contact}
                  onClick={() => {
                    const peerId =
                      contact.peerId || contact.registeredUserId || contact.id;
                    if (onSelectChat && contact.registeredUserId) {
                      onSelectChat(peerId);
                    } else {
                      handleContactClick(contact);
                    }
                  }}
                  onPin={handlePinContact}
                  onUnpin={handleUnpinContact}
                  onForward={handleForwardMessage}
                  onEdit={(c) => {}}
                  onDelete={(id) => {}}
                  theme={theme}
                  active={
                    selectedChatId ===
                    (contact.peerId || contact.registeredUserId || contact.id)
                  }
                />
              </motion.div>
            ))}

            {visibleGroups.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 pt-4 pb-1 flex items-center gap-2"
              >
                <span
                  className={`text-[11px] font-semibold uppercase tracking-wide ${textMuted}`}
                >
                  Groups
                </span>
                <span className={`flex-1 h-px ${borderColor}`} />
              </motion.div>
            )}
            {visibleGroups.map((g: any) => {
              const isActive = selectedChatId === g.id;
              let lastText = g?.lastMessage || "No messages yet";
              if (typeof lastText !== "string") lastText = "No messages yet";
              if (lastText.length > 50) lastText = lastText.slice(0, 49) + "…";
              let when = "";
              try {
                const d = new Date(
                  g?.lastMessageTime || g?.updatedAt || Date.now(),
                );
                if (!isNaN(d.getTime()))
                  when = format(d, "h:mm a").toLowerCase();
              } catch {}
              const memberCount = Array.isArray(g?.members)
                ? g.members.length
                : 0;
              return (
                <motion.button
                  key={g.id || Math.random()}
                  whileTap={{ scale: 0.995 }}
                  onClick={() => {
                    if (onSelectChat) onSelectChat(g.id);
                    else router.push(`/chat/${g.id}`);
                  }}
                  className={`w-full text-left flex items-center gap-3 px-3 py-2.5 transition-colors border-b ${borderColor} ${
                    isActive ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shadow-sm"
                      style={{
                        background: g?.avatar
                          ? undefined
                          : "linear-gradient(135deg, #00a884 0%, #008069 100%)",
                      }}
                    >
                      {g?.avatar ? (
                        <Image
                          src={g.avatar}
                          alt={g.name || "Group"}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
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
                        <Users
                          className={`w-3.5 h-3.5 flex-shrink-0 ${textMuted}`}
                        />
                        <p
                          className={`font-semibold text-[15.5px] truncate ${textColor}`}
                        >
                          {g.name || "Group"}
                        </p>
                      </div>
                      <p
                        className={`text-[13.5px] truncate mt-0.5 ${textMuted}`}
                      >
                        {memberCount
                          ? `${memberCount} member${memberCount > 1 ? "s" : ""} · `
                          : ""}
                        {lastText}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {when && (
                        <span className={`text-[11px] ${textMuted}`}>
                          {when}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
          {filteredContacts.length === 0 &&
            visibleGroups.length === 0 &&
            !loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-12"
              >
                <p className={`text-sm ${textMuted}`}>
                  No contacts or groups found
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
