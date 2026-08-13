'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/common/Loading/Loading'
import dynamic from 'next/dynamic'
const ChatHome = dynamic(() => import('@/components/pages/ChatHome/ChatHome'));
const ChatWindow = dynamic(() => import('@/components/pages/ChatWindow/ChatWindow'));

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [theme, setTheme] = useState({
    primary: '#0CA678',
    secondary: '#A2F5BF',
    wallpaper: 'bg-gradient-to-br from-emerald-50 to-teal-50',
    textSize: 'text-base',
  })
  const router = useRouter()

  useEffect(() => {
    const savedUser = localStorage.getItem('hansariaUser')
    const savedTheme = localStorage.getItem('hansariaTheme')
    if (savedUser) setUser(JSON.parse(savedUser))
    if (savedTheme) setTheme(JSON.parse(savedTheme))
  }, [])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {}
    localStorage.removeItem('hansariaUser')
    setUser(null)
    router.replace('/')
  }

  if (!user) {
    return (
      <Loading />
    )
  }

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)

  return (
    <div className="min-h-screen w-full bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4">
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden" style={{ minHeight: '70vh' }}>
          <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
            <div className="border-r border-gray-100">
              <ChatHome
                user={user}
                theme={theme}
                onLogout={handleLogout}
                selectedChatId={selectedChatId || undefined}
                onSelectChat={(id: string) => setSelectedChatId(id)}
              />
            </div>
            <div className="hidden md:block">
              {selectedChatId ? (
                <ChatWindow user={user} theme={theme} id={selectedChatId} />
              ) : (
                <div className="h-full flex items-center justify-center p-8 text-center text-gray-500">
                  Select a chat to start messaging
                </div>
              )}
            </div>
          </div>
          {/* Mobile: show chat pane full screen when selected */}
          {selectedChatId && (
            <div className="md:hidden">
              <ChatWindow user={user} theme={theme} id={selectedChatId} onBack={() => setSelectedChatId(null)} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
