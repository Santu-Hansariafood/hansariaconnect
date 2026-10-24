"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { ArrowUp, Mic, Paperclip, Smile } from "lucide-react";
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
import { ChatMessage, Theme, ForwardContact } from "./ChatWindowTypes";
import Loading from "@/components/common/Loading/Loading";

const Picker = dynamic(() => import("emoji-picker-react"), {
  loading: () => (
    <div
      className="h-[360px] w-full animate-pulse rounded-xl bg-slate-100"
      aria-label="Loading emoji picker"
    />
  ),
});

interface ChatWindowFooterProps {
  theme: Theme;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  handleSend: () => void;
  focusInputRequest: number;
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
  focusInputRequest,
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

  useEffect(() => {
    if (focusInputRequest > 0) {
      messageInputRef.current?.focus();
    }
  }, [focusInputRequest]);

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
        <div className="mx-auto flex max-w-4xl items-end gap-1.5 sm:gap-2">
          {isRecording ? (
            <VoiceRecorder
              onRecordingComplete={handleVoiceRecorded}
              onCancel={() => setIsRecording(false)}
              theme={theme}
            />
          ) : (
            <>
              <div className="flex h-11 shrink-0 items-center">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#e4e9eb] hover:text-[var(--brand-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                  title="Add emoji"
                  aria-label="Add emoji"
                >
                  <Smile className="h-[22px] w-[22px]" strokeWidth={1.9} />
                </button>
              </div>

              <div className="flex min-h-11 min-w-0 flex-1 items-end rounded-[24px] border border-[#e2e8e9] bg-white px-1 shadow-[0_1px_2px_rgba(15,23,42,0.06)] transition-colors duration-150 focus-within:border-[var(--brand-primary)] focus-within:ring-4 focus-within:ring-[var(--brand-primary)]/10">
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
                  placeholder="Message"
                  className="max-h-36 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2.5 text-base leading-5 text-[#172126] outline-none placeholder:text-[#879397] focus:ring-0 sm:px-4 sm:text-[15px]"
                />
              </div>

              <div className="flex h-11 shrink-0 items-center">
                {allowAttachments && (
                  <button
                    type="button"
                    onClick={() => setShowMediaPicker(!showMediaPicker)}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-[#54656f] transition-colors duration-150 hover:bg-[#e4e9eb] hover:text-[var(--brand-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                    title="Attach file, image, or video"
                    aria-label="Attach file, image, or video"
                  >
                    <Paperclip className="h-[22px] w-[22px]" strokeWidth={2.1} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  if (message.trim()) {
                    handleSendWithTypingClear();
                  } else {
                    setIsRecording(true);
                  }
                }}
                style={{ backgroundColor: theme.primary }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-[0_2px_5px_rgba(15,23,42,0.18)] transition duration-200 hover:brightness-105 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 active:scale-95"
                title={message.trim() ? "Send message" : "Record voice message"}
                aria-label={message.trim() ? "Send message" : "Record voice message"}
              >
                {message.trim() ? (
                  <ArrowUp className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={2.5} />
                ) : (
                  <Mic className="h-[18px] w-[18px] sm:h-5 sm:w-5" />
                )}
              </button>
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
