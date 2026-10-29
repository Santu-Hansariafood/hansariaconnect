"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ReactionPickerProps {
  onReactionSelect: (emoji: string) => void;
  onClose?: () => void;
  position?: "top" | "bottom";
  align?: "left" | "right";
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "✨", "🎉", "💯", "🤝"];

export default function ReactionPicker({
  onReactionSelect,
  onClose,
  position = "top",
  align = "left",
}: ReactionPickerProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: position === "top" ? 10 : -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        onClick={(event) => event.stopPropagation()}
        className={`absolute ${
          position === "top" ? "bottom-full mb-2" : "top-full mt-2"
        } ${
          align === "right" ? "right-0" : "left-0"
        } z-50 flex max-w-[min(20rem,calc(100vw-2rem))] flex-wrap items-center justify-center gap-1.5 rounded-full border border-white/60 bg-white/70 p-2 shadow-[0_12px_40px_rgba(15,23,42,0.18)] backdrop-blur-2xl backdrop-saturate-150`}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            onClick={(event) => {
              event.stopPropagation();
              onReactionSelect(emoji);
              onClose?.();
            }}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[19px] transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/70"
            title={emoji}
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
