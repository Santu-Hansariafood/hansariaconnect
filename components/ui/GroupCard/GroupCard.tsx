"use client"

import { motion } from "framer-motion"
import { formatDistanceToNow } from "date-fns"
import { Users, Shield, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import React from "react"

interface Group {
  id: string
  name: string
  avatar: string
  members: Array<{ id: string; name: string }>
  admin: string
  lastMessage?: string
  lastMessageTime?: string
}

interface Theme {
  primary: string
  textSize?: string
}

interface User {
  mobile: string
}

interface GroupCardProps {
  group: Group
  user: User
  theme: Theme
  onClick?: () => void
}

const GroupCard: React.FC<GroupCardProps> = ({ group, user, theme, onClick }) => {
  const router = useRouter()
  const isAdmin = group.admin === user.mobile

  const handleSettingsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    router.push(`/group-settings/${group.id}`)
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-full overflow-hidden border-2 flex-shrink-0"
            style={{ borderColor: theme.primary }}
          >
            <Image
              src={group.avatar || "/default-avatar.png"}
              alt={group.name}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          </div>
          <div>
            <h3 className={`font-bold text-gray-800 ${theme.textSize || "text-base"}`}>
              {group.name}
            </h3>
            <div className="flex items-center gap-1 text-sm text-gray-500">
              <Users className="w-4 h-4" />
              <span>{group.members?.length || 0} members</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSettingsClick}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Group settings"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </motion.button>
        )}
      </div>
      {group.lastMessage && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 line-clamp-2">{group.lastMessage}</p>
          <div className="flex items-center justify-between">
            {group.lastMessageTime && (
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(group.lastMessageTime), { addSuffix: true })}
              </span>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                <Shield className="w-3 h-3" />
                Admin
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default GroupCard
