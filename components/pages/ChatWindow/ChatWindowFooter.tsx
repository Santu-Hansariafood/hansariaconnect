"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { motion } from "framer-motion";
import { Mic, Plus, Smile, Send } from "lucide-react";
import dynamic from "next/dynamic";

const MediaPicker = dynamic(
  () => import("@/components/ui/MediaPicker/MediaPicker"),
);
const ForwardModal = dynamic(
  () => import("@/components/ui/ForwardModal/ForwardModal"),
);
const VoiceRecorder = dynamic(
  () => import("@/components/ui/VoiceRecorder/VoiceRecorder"),
);
import Picker from "emoji-picker-react";
import { ChatMessage, Theme, ForwardContact } from "./ChatWindowTypes";
import Loading from "@/components/common/Loading/Loading";

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
  handleMediaSelect: (
    fileOrData: File | { url: string },
    type: ChatMessage["type"],
    duration?: number,
  ) => Promise<void>;
  showForwardModal: boolean;
  contacts: ForwardContact[];
  onCloseForward: () => void;
  onForwardSubmit: (
    selectedContactIds: string[],
    text: string,
  ) => Promise<void>;
  sendTyping?: (isTyping: boolean) => void;
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
  sendTyping,
}: ChatWindowFooterProps) {
  const [isRecording, setIsRecording] = useState(false);
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const input = messageInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [message]);

  const handleSendWithTypingClear = () => {
    sendTyping?.(false);
    handleSend();
  };

  const handleVoiceRecorded = async (blob: Blob, duration: number) => {
    setIsRecording(false);
    const audioFile = new File([blob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });
    await handleMediaSelect(audioFile, "voice", duration);
  };

  return (
    <Suspense fallback={<Loading />}>
      <div
        className="sticky bottom-0 z-30 w-full overflow-visible border-t border-[#e9edef] bg-[#f0f2f5] px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-4 sm:py-2.5"
      >
        <div className="mx-auto flex max-w-4xl items-center gap-1.5 sm:gap-2">
          {!isRecording && (
            <>
              <button
                type="button"
                onClick={() => setShowMediaPicker(!showMediaPicker)}
                className="rounded-full p-2.5 text-[#54656f] transition-all duration-200 hover:bg-[#e5e7eb]"
                title="Attach file, image, or video"
                aria-label="Attach file, image, or video"
              >
                <Plus className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="rounded-full p-2.5 text-[#54656f] transition-all duration-200 hover:bg-[#e5e7eb]"
                title="Add emoji"
                aria-label="Add emoji"
              >
                <Smile className="h-5 w-5" />
              </button>
            </>
          )}

          {isRecording ? (
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecorded}
              onCancel={() => setIsRecording(false)}
              theme={theme}
            />
          ) : (
            <>
              <textarea
                ref={messageInputRef}
                rows={1}
                spellCheck={true}
                autoCorrect="on"
                autoCapitalize="sentences"
                aria-label="Message"
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  e.currentTarget.style.height = "auto";
                  e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 144)}px`;
                  if (e.target.value.trim()) {
                    sendTyping?.(true);
                  } else {
                    sendTyping?.(false);
                  }
                }}
                onBlur={() => sendTyping?.(false)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    handleSendWithTypingClear();
                  }
                }}
                placeholder="Type a message..."
                className="max-h-36 min-h-10 flex-1 min-w-0 resize-none overflow-y-auto rounded-[1.25rem] border border-transparent bg-white px-3 py-2.5 text-[14px] leading-5 text-[#111b21] shadow-sm placeholder:text-[#667781] focus:border-[#009688] focus:outline-none sm:px-4 sm:text-[15px]"
              />

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  if (message.trim()) {
                    handleSendWithTypingClear();
                  } else {
                    setIsRecording(true);
                  }
                }}
                style={{ backgroundColor: theme.primary }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition-shadow hover:shadow-md sm:h-11 sm:w-11"
                title={message.trim() ? "Send message" : "Record voice message"}
                aria-label={message.trim() ? "Send message" : "Record voice message"}
              >
                {message.trim() ? (
                  <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Mic className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </motion.button>
            </>
          )}
        </div>

        {showEmojiPicker && (
          <div className="absolute bottom-full left-2 right-2 z-50 mb-2 sm:left-4 sm:right-auto">
            <Picker
              width="100%"
              height={360}
              onEmojiClick={(emojiObject) => {
                setMessage((prev: string) => prev + emojiObject.emoji);
                setShowEmojiPicker(false);
              }}
            />
          </div>
        )}

        {showMediaPicker && allowAttachments && (
          <MediaPicker
            onSelect={handleMediaSelect}
            onClose={() => setShowMediaPicker(false)}
          />
        )}

        {showForwardModal && (
          <ForwardModal
            contacts={contacts}
            theme={theme}
            onClose={onCloseForward}
            onForward={onForwardSubmit}
          />
        )}
      </div>
    </Suspense>
  );
}
