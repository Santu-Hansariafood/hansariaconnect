"use client";

import { motion } from "framer-motion";
import {
  ArrowLeft,
  MoreVertical,
  Trash2,
  Search as SearchIcon,
  Ban,
  CircleUserRound,
} from "lucide-react";
import { Theme } from "./ChatWindowTypes";

const getSafeAvatarUrl = (value?: string | null) => {
  if (!value || typeof value !== "string") {
    return "/logo/logo.png";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "/logo/logo.png";
  }

  const normalized = trimmed.replace(/^\s+|\s+$/g, "");
  if (!normalized || normalized === "null" || normalized === "undefined") {
    return "/logo/logo.png";
  }

  if (normalized.startsWith("data:image/") || normalized.startsWith("blob:")) {
    return normalized;
  }

  if (/^(https?:)?\/\//i.test(normalized)) {
    return normalized;
  }

  return normalized;
};

interface ChatWindowHeaderProps {
  theme: Theme;
  onBack: () => void;
  headerName: string;
  headerAvatar: string;
  isContactOnline: boolean;
  isGroup: boolean;
  showUnreadBanner: boolean;
  unreadOnOpen: number;
  showOptionsMenu: boolean;
  setShowOptionsMenu: (value: boolean) => void;
  isSavedContact: boolean;
  onSaveContact: () => void;
  onEditContact: () => void;
  onClearClick: () => void;
  onSearch: () => void;
  onBlockToggle: () => void;
  maskedUrl: string;
  onOpenGroup?: () => void;
  lastSeenStatus?: string;
}

export default function ChatWindowHeader({
  theme,
  onBack,
  headerName,
  headerAvatar,
  isContactOnline,
  isGroup,
  onOpenGroup,
  showUnreadBanner,
  unreadOnOpen,
  showOptionsMenu,
  setShowOptionsMenu,
  isSavedContact,
  onSaveContact,
  onEditContact,
  onClearClick,
  onSearch,
  onBlockToggle,
  maskedUrl,
  lastSeenStatus,
}: ChatWindowHeaderProps) {
  const primaryColor = theme.primary || "#0CA678";
  const borderColor = theme.primary ? theme.primary + "80" : "#0b4d45";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        backgroundColor: primaryColor,
        borderBottomColor: borderColor,
      }}
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] text-white shadow-sm sm:px-3 sm:py-2"
    >
      <button
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all duration-200 hover:bg-white/10"
        aria-label="Back to chats"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative shrink-0">
          {isGroup && onOpenGroup ? (
            <button onClick={onOpenGroup} className="p-0 rounded-full">
              <img
                src={getSafeAvatarUrl(headerAvatar)}
                alt={headerName}
                width={40}
                height={40}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.onerror = null;
                  target.src = "/logo/logo.png";
                }}
              />
            </button>
          ) : (
            <img
              src={getSafeAvatarUrl(headerAvatar)}
              alt={headerName}
              width={40}
              height={40}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              className="h-10 w-10 rounded-full object-cover ring-2 ring-white/20"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.onerror = null;
                target.src = "/logo/logo.png";
              }}
            />
          )}

          {isContactOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#f0f2f5] rounded-full" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-white">
            {headerName}
          </h2>
          <span
            className={`truncate text-[12px] ${
              !isGroup &&
              (isContactOnline || lastSeenStatus?.includes("online"))
                ? "text-emerald-200"
                : "text-gray-200"
            }`}
          >
            {isGroup
              ? "Group chat"
              : lastSeenStatus || (isContactOnline ? "online" : "offline")}
          </span>
        </div>

        {showUnreadBanner && unreadOnOpen > 0 && (
          <span className="text-[11px] px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full ml-2 shrink-0">
            {unreadOnOpen} unread
          </span>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setShowOptionsMenu(!showOptionsMenu)}
          className="rounded-full p-2 text-white transition-all duration-200 hover:bg-white/10"
        >
          <MoreVertical className="h-5 w-5" />
        </button>

        {showOptionsMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
          >
            <div
              className="px-4 py-3"
              style={{
                background: `linear-gradient(to right, ${theme.primary}, ${theme.primary}AA, ${theme.primary}66, ${theme.secondary ?? theme.primary})`,
              }}
            >
              <p className="text-white font-semibold text-sm">{headerName}</p>
              <p className="text-white/80 text-xs">Chat URL: {maskedUrl}</p>
            </div>

            <div className="py-2">
              {!isSavedContact ? (
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onSaveContact();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <CircleUserRound className="w-5 h-5 text-emerald-600" />
                  <span className="text-gray-700 font-medium">
                    Save Contact
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    setShowOptionsMenu(false);
                    onEditContact();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <CircleUserRound className="w-5 h-5 text-blue-600" />
                  <span className="text-gray-700 font-medium">
                    Edit Contact Name
                  </span>
                </button>
              )}

              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onClearClick();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Trash2 className="w-5 h-5 text-red-500" />
                <span className="text-gray-700 font-medium">Clear Chat</span>
              </button>

              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onSearch();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <SearchIcon className="w-5 h-5 text-blue-500" />
                <span className="text-gray-700 font-medium">Search</span>
              </button>

              <button
                onClick={() => {
                  setShowOptionsMenu(false);
                  onBlockToggle();
                }}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                <Ban className="w-5 h-5 text-orange-500" />
                <span className="text-gray-700 font-medium">Block/Mute</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}
