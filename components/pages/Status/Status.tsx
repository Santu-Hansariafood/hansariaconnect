'use client'

import { useState, ChangeEvent } from 'react';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { statuses } from '@/data/mockData';
import { staggerContainer, fadeIn } from '@/utils/animations/animations';
import dynamic from 'next/dynamic';
const Navbar = dynamic(() => import('@/components/common/Navbar/Navbar'));
const StatusCard = dynamic(() => import('@/components/common/StatusCard/StatusCard'));

interface User {
  name: string
  photo: string
}

interface Theme {
  wallpaper: string
  textSize?: string
  primary?: string
}

interface StatusItem {
  id: number
  user: string
  avatar: string
  media: string
  type: 'image' | 'video'
  timestamp: string
  views: number
}

export default function StatusPage({
  user,
  theme,
}: {
  user: User
  theme: Theme
}) {
  const [myStatus, setMyStatus] = useState<StatusItem | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  const handleStatusUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setMyStatus({
          id: Date.now(),
          user: user.name,
          avatar: user.photo,
          media: reader.result as string,
          type: file.type.startsWith('video') ? 'video' : 'image',
          timestamp: new Date().toISOString(),
          views: 0,
        })
        setShowUpload(false)
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className={`text-3xl font-bold text-gray-800 mb-4 ${theme.textSize}`}>
            Status Updates
          </h1>
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
          <motion.div variants={fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">My Status</h2>

            {myStatus ? (
              <StatusCard status={myStatus} theme={theme} />
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={user.photo}
                    alt={user.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  <label
                    className="absolute bottom-0 right-0 p-2 rounded-full cursor-pointer shadow-lg"
                    style={{ backgroundColor: theme.primary }}
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleStatusUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Add Status</p>
                  <p className="text-sm text-gray-500">Share your moment</p>
                </div>
              </div>
            )}
          </motion.div>
          <motion.div variants={fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Updates</h2>
            <div className="space-y-4">
              {statuses.map((status: StatusItem) => (
                <StatusCard key={status.id} status={status} theme={theme} />
              ))}
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
