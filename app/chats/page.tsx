'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/common/Loading/Loading'
import dynamic from 'next/dynamic'
const ChatHome = dynamic(() => import('@/components/pages/ChatHome/ChatHome'));

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

  const handleLogout = () => {
    localStorage.removeItem('hansariaUser')
    setUser(null)
    router.push('/')
  }

  if (!user) {
    return (
      <Loading />
    )
  }

  return <ChatHome user={user} theme={theme} onLogout={handleLogout} />
}
