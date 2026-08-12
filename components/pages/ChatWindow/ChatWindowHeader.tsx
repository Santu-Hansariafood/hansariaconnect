"use client";

import Image from "next/image";
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
}

export default function ChatWindowHeader({
  theme,
  onBack,
  headerName,
  headerAvatar,
  isContactOnline,
  isGroup,
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
}: ChatWindowHeaderProps) {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="border-b border-gray-200 px-4 py-2.5 flex items-center gap-3 shadow-sm"
      style={{ backgroundColor: `${theme.primary || "#00a884"}19` }}
    >
      <button
        onClick={onBack}
        className="p-2 hover:bg-gray-200/70 rounded-full transition-all duration-200"
      >
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </button>

      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="relative shrink-0">
          <Image
            src={headerAvatar || "/logo/logo.png"}
            alt={headerName}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />

          {isContactOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#f0f2f5] rounded-full" />
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h2 className="font-semibold text-gray-800 text-[15px] truncate">
            {headerName}
          </h2>
          <span className={`text-[12px] truncate ${!isGroup && isContactOnline ? "text-green-600" : "text-gray-500"}`}>
            {isGroup ? "Group chat" : isContactOnline ? "online" : "Offline"}
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
          className="p-2 hover:bg-gray-200/70 rounded-full transition-all duration-200"
        >
          <MoreVertical className="w-5 h-5 text-gray-600" />
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
                  <span className="text-gray-700 font-medium">Save Contact</span>
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
                  <span className="text-gray-700 font-medium">Edit Contact Name</span>
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
