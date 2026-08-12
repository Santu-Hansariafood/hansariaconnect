"use client";

import React from "react";
import { motion } from "framer-motion";
import { Image as ImageIcon, Smile, Send } from "lucide-react";
import MediaPicker from "@/components/ui/MediaPicker/MediaPicker";
import ForwardModal from "@/components/ui/ForwardModal/ForwardModal";
import Picker from "emoji-picker-react";
import { ChatMessage, Theme, ForwardContact } from "./ChatWindowTypes";

interface ChatWindowFooterProps {
  theme: Theme;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  showEmojiPicker: boolean;
  setShowEmojiPicker: React.Dispatch<React.SetStateAction<boolean>>;
  allowAttachments: boolean;
  showMediaPicker: boolean;
  setShowMediaPicker: React.Dispatch<React.SetStateAction<boolean>>;
  handleMediaSelect: (fileOrData: File | { url: string }, type: ChatMessage["type"]) => Promise<void>;
  showForwardModal: boolean;
  contacts: ForwardContact[];
  onCloseForward: () => void;
  onForwardSubmit: (selectedContactIds: string[], text: string) => Promise<void>;
}

export default function ChatWindowFooter({
  theme,
  message,
  setMessage,
  handleSend,
  showEmojiPicker,
  setShowEmojiPicker,
  allowAttachments,
  showMediaPicker,
  setShowMediaPicker,
  handleMediaSelect,
  showForwardModal,
  contacts,
  onCloseForward,
  onForwardSubmit,
}: ChatWindowFooterProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-[#f0f2f5] border-t border-gray-200 px-2 sm:px-4 py-2 sm:py-2.5 relative min-w-0 w-full"
    >
      <div className="max-w-4xl mx-auto flex items-center gap-1 sm:gap-2 min-w-0">
        <button
          onClick={() => {
            if (allowAttachments) {
              setShowMediaPicker(!showMediaPicker)
            }
          }}
          disabled={!allowAttachments}
          className="p-2.5 hover:bg-gray-200/70 rounded-full transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          title="Attach"
        >
          <ImageIcon className="w-5 h-5 text-gray-500" />
        </button>

        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2.5 hover:bg-gray-200/70 rounded-full transition-all duration-200"
          title="Emoji"
        >
          <Smile className="w-5 h-5 text-gray-500" />
        </button>

        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Type a message..."
          className={`flex-1 min-w-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-white rounded-full focus:outline-none focus:ring-0 border border-transparent hover:border-gray-200 text-[14px] sm:text-[15px] ${theme.textSize}`}
        />

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={handleSend}
          className="p-2 sm:p-2.5 rounded-full text-white shadow-sm shrink-0 hover:shadow-lg transition-shadow"
          style={{ backgroundColor: theme.primary || "#00a884" }}
          title="Send"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </motion.button>
      </div>

      {showEmojiPicker && (
        <div className="absolute bottom-full left-4 mb-2 z-50">
          <Picker
            onEmojiClick={(emojiObject) => {
              setMessage((prev: string) => prev + emojiObject.emoji);
              setShowEmojiPicker(false);
            }}
          />
        </div>
      )}

      {showMediaPicker && allowAttachments && (
        <MediaPicker onSelect={handleMediaSelect} onClose={() => setShowMediaPicker(false)} />
      )}

      {showForwardModal && (
        <ForwardModal
          contacts={contacts}
          theme={theme}
          onClose={onCloseForward}
          onForward={onForwardSubmit}
        />
      )}
    </motion.div>
  );
}
