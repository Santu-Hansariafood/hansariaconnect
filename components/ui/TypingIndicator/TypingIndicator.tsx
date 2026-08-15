"use client";

import { motion } from "framer-motion";

interface TypingIndicatorProps {
  typingUsers: string[];
  isGroup?: boolean;
}

export default function TypingIndicator({
  typingUsers,
  isGroup = false,
}: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const typingText = isGroup
    ? typingUsers.length === 1
      ? `${typingUsers[0]} is typing...`
      : `${typingUsers.length} people are typing...`
    : "typing...";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="px-4 py-2 text-sm text-gray-500 flex items-center gap-2"
    >
      <span>{typingText}</span>
      <div className="flex gap-1">
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6 }}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0.1 }}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        />
        <motion.span
          animate={{ y: [0, -4, 0] }}
          transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
          className="w-1.5 h-1.5 bg-gray-400 rounded-full"
        />
      </div>
    </motion.div>
  );
}
