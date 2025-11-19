"use client";

import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { Eye, Play } from "lucide-react";


type Theme = {
  textSize?: string;
};

type Status = {
  avatar: string;
  user: string;
  type: "image" | "video";
  timestamp: string | number | Date;
  views: number;
};

type StatusCardProps = {
  status: Status;
  theme: Theme;
};

const StatusCard: React.FC<StatusCardProps> = ({ status, theme }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
    >
      <div className="relative">
        <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-emerald-500 to-teal-500">
          <img
            src={status.avatar}
            alt={status.user}
            className="w-full h-full rounded-full object-cover border-2 border-white"
          />
        </div>

        {status.type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 bg-white/90 rounded-full flex items-center justify-center">
              <Play className="w-3 h-3 text-gray-800" />
            </div>
          </div>
        )}
      </div>
      <div className="flex-1">
        <h3 className={`font-semibold text-gray-800 ${theme.textSize || ""}`}>
          {status.user}
        </h3>
        <p className="text-sm text-gray-500">
          {formatDistanceToNow(new Date(status.timestamp), { addSuffix: true })}
        </p>
      </div>
      <div className="flex items-center gap-1 text-gray-500">
        <Eye className="w-4 h-4" />
        <span className="text-sm">{status.views}</span>
      </div>
    </motion.div>
  );
};

export default StatusCard;
