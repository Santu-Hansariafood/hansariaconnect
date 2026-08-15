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
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)

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

  return (
    <div className="min-h-screen w-full bg-[#eae6df]">
      <div className="mx-auto h-screen max-w-[1600px] overflow-hidden bg-[#f0f2f5]">
        <div className="grid h-full grid-cols-1 md:grid-cols-[360px_1fr]">
          <div className="h-full min-h-0 border-r-0 bg-[#f6f6f6] md:border-r md:border-[#e9edef]">
            <ChatHome
              user={user}
              theme={theme}
              onLogout={handleLogout}
              selectedChatId={selectedChatId || undefined}
              onSelectChat={(id: string) => setSelectedChatId(id)}
            />
          </div>

          <div className="hidden h-full min-h-0 md:block">
            {selectedChatId ? (
              <ChatWindow user={user} theme={theme} id={selectedChatId} />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#f8fafc] p-8 text-center">
                <div className="max-w-sm rounded-2xl border border-dashed border-[#d1d5db] bg-white/90 p-8 shadow-sm">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#e7f7ef] text-[#075e54]">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-8 w-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 6.5A2.5 2.5 0 0 1 8.5 4h7A2.5 2.5 0 0 1 18 6.5v8A2.5 2.5 0 0 1 15.5 17H11l-4 3v-3H8.5A2.5 2.5 0 0 1 6 14.5v-8Z" />
                    </svg>
                  </div>
                  <p className="text-lg font-semibold text-[#111b21]">Select a chat to start messaging</p>
                  <p className="mt-2 text-sm text-[#667781]">Choose a contact or group from the left panel.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {selectedChatId && (
          <div className="md:hidden">
            <ChatWindow user={user} theme={theme} id={selectedChatId} onBack={() => setSelectedChatId(null)} />
          </div>
        )}
      </div>
    </div>
  )
}
