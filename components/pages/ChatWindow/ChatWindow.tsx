"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Image as ImageIcon,
  MoreVertical,
  X,
  Trash2,
  Search as SearchIcon,
  Ban,
} from "lucide-react";
import { contacts, messages } from "@/data/mockData";
import dynamic from "next/dynamic";
const MessageBubble = dynamic(() => import("@/components/ui/MessageBubble/MessageBubble"));
const MediaPicker = dynamic(() => import("@/components/ui/MediaPicker/MediaPicker"));

interface Theme {
  primary: string;
  textSize?: string;
  wallpaper?: string;
}

interface User {
  id: number;
  name: string;
  avatar: string;
}

interface ChatWindowProps {
  user: User;
  theme: Theme;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ user, theme }) => {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState(
    messages.filter((m) => m.contactId === parseInt(id))
  );
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<typeof messages>([]);
  const [isBlocked, setIsBlocked] = useState(false);

  const contact = contacts.find((c) => c.id === parseInt(id));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (!contact) return null;

  const handleSend = () => {
    if (message.trim()) {
      const newMessage = {
        id: Date.now(),
        contactId: parseInt(id),
        text: message,
        sender: "me" as const,
        timestamp: new Date().toISOString(),
        type: "text",
        status: "sent",
      };
      setChatMessages((prev) => [...prev, newMessage]);
      setMessage("");

      setTimeout(() => {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: "delivered" } : msg
          )
        );
      }, 1000);

      setTimeout(() => {
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === newMessage.id ? { ...msg, status: "seen" } : msg
          )
        );
      }, 3000);
    }
  };

  const handleMediaSelect = (fileOrData: any, type: string) => {
    const newMessage: any = {
      id: Date.now(),
      contactId: parseInt(id),
      sender: "me" as const,
      timestamp: new Date().toISOString(),
      type,
      status: "sent",
    };

    if (type === "link") {
      newMessage.url = fileOrData.url;
      newMessage.linkTitle = "Shared Link";
    } else if (type === "voice") {
      newMessage.media = URL.createObjectURL(fileOrData);
      newMessage.duration = "15";
    } else if (type === "pdf" || type === "excel") {
      newMessage.fileName = fileOrData.name;
      newMessage.fileSize =
        (fileOrData.size / (1024 * 1024)).toFixed(2) + " MB";
      newMessage.media = URL.createObjectURL(fileOrData);
    } else {
      newMessage.media = URL.createObjectURL(fileOrData);
    }

    setChatMessages((prev) => [...prev, newMessage]);
    setShowMediaPicker(false);

    setTimeout(() => {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: "delivered" } : msg
        )
      );
    }, 1000);

    setTimeout(() => {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === newMessage.id ? { ...msg, status: "seen" } : msg
        )
      );
    }, 3000);
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setShowClearConfirm(false);
    setShowOptionsMenu(false);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      const results = chatMessages.filter(
        (msg) => msg.text && msg.text.toLowerCase().includes(query.toLowerCase())
      );
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const handleBlockToggle = () => {
    setIsBlocked((prev) => !prev);
    setShowOptionsMenu(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 shadow-sm"
        style={{ backgroundColor: `${theme.primary}10` }}
      >
        <button
          onClick={() => router.push("/")}
          className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
        >
          <ArrowLeft className="w-6 h-6" style={{ color: theme.primary }} />
        </button>

        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <img
              src={contact.avatar}
              alt={contact.name}
              className="w-10 h-10 rounded-full object-cover"
            />
            {contact.online && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
            )}
          </div>
          <h2 className={`font-semibold text-gray-800 ${theme.textSize}`}>
            {contact.name}
          </h2>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowOptionsMenu((prev) => !prev)}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
          >
            <MoreVertical className="w-5 h-5 text-gray-600" />
          </button>

          {showOptionsMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 top-12 w-64 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50"
            >
              <div
                className="px-4 py-3"
                style={{
                  background: `linear-gradient(to right, ${theme.primary}, ${theme.primary}AA, ${theme.primary}66, ${theme.secondary})`,
                }}
              >
                <p className="text-white font-semibold text-sm">{contact.name}</p>
                <p className="text-white/80 text-xs">{contact.mobile}</p>
              </div>

              <div className="py-2">
                <button
                  onClick={() => {
                    setShowClearConfirm(true);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Trash2 className="w-5 h-5 text-red-500" />
                  <span className="text-gray-700 font-medium">Clear Chat</span>
                </button>

                <button
                  onClick={() => {
                    setShowSearch(true);
                    setShowOptionsMenu(false);
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <SearchIcon className="w-5 h-5 text-blue-500" />
                  <span className="text-gray-700 font-medium">Search</span>
                </button>

                <button
                  onClick={handleBlockToggle}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <Ban className="w-5 h-5 text-orange-500" />
                  <span className="text-gray-700 font-medium">
                    {isBlocked ? "Unmute" : "Block/Mute"}
                  </span>
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.header>
      <div className={`flex-1 overflow-y-auto p-4 ${theme.wallpaper}`}>
        <div className="max-w-4xl mx-auto space-y-3">
          {chatMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              user={user}
              contact={contact}
              theme={theme}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-t border-gray-200 p-4"
      >
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <button
            onClick={() => setShowMediaPicker((prev) => !prev)}
            className="p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:scale-110"
          >
            <ImageIcon className="w-6 h-6 text-gray-600" />
          </button>

          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type a message..."
            className={`w-full px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 ${theme.textSize}`}
            style={{ "--tw-ring-color": theme.primary } as React.CSSProperties}
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            className="p-3 rounded-full text-white shadow-lg"
            style={{ backgroundColor: theme.primary }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>

        {showMediaPicker && (
          <MediaPicker
            onSelect={handleMediaSelect}
            onClose={() => setShowMediaPicker(false)}
          />
        )}
      </motion.div>
    </div>
  );
};

export default ChatWindow;
