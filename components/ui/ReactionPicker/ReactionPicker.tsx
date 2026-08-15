"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Smile } from "lucide-react";

interface ReactionPickerProps {
  onReactionSelect: (emoji: string) => void;
  onClose?: () => void;
  position?: "top" | "bottom";
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "✨", "🎉", "💯", "🤝"];

export default function ReactionPicker({
  onReactionSelect,
  onClose,
  position = "top",
}: ReactionPickerProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: position === "top" ? 10 : -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className={`absolute ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"} left-0 z-50 flex items-center gap-1 bg-white rounded-full p-2 shadow-lg border border-gray-200`}
      >
        {REACTION_EMOJIS.map((emoji) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              onReactionSelect(emoji);
              onClose?.();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-lg cursor-pointer"
            title={emoji}
          >
            {emoji}
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
