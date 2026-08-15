"use client";

import { motion } from "framer-motion";
import { ArrowLeft, MoreVertical } from "lucide-react";

interface WhatsAppHeaderProps {
  title: string;
  subtitle?: string;
  avatar?: string;
  onBack?: () => void;
  onMoreClick?: () => void;
  showMoreButton?: boolean;
  isGroup?: boolean;
  theme?: { primary?: string };
}

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

export default function WhatsAppHeader({
  title,
  subtitle,
  avatar,
  onBack,
  onMoreClick,
  showMoreButton = true,
  isGroup = false,
  theme,
}: WhatsAppHeaderProps) {
  const primaryColor = theme?.primary || "#0CA678";
  const borderColor = theme?.primary ? theme.primary + "80" : "#0b4d45";

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      style={{
        backgroundColor: primaryColor,
        borderBottomColor: borderColor,
      }}
      className="sticky top-0 z-30 flex items-center gap-3 border-b px-2 py-2 text-white shadow-sm sm:px-3"
    >
      {onBack && (
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white transition-all duration-200 hover:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      )}

      <div className="flex items-center gap-3 flex-1 min-w-0">
        {avatar && (
          <div className="relative shrink-0">
            <img
              src={getSafeAvatarUrl(avatar)}
              alt={title}
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
          </div>
        )}

        <div className="flex flex-col min-w-0">
          <h2 className="truncate text-[15px] font-semibold text-white">
            {title}
          </h2>
          {subtitle && (
            <span className="truncate text-[12px] text-gray-200">
              {subtitle}
            </span>
          )}
        </div>
      </div>

      {showMoreButton && onMoreClick && (
        <button
          onClick={onMoreClick}
          className="rounded-full p-2 text-white transition-all duration-200 hover:bg-white/10"
          aria-label="More options"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      )}
    </motion.header>
  );
}
