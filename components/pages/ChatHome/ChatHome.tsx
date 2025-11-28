'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { X, Phone, Clock, Ban, CheckCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { staggerContainer, fadeIn } from '@/utils/animations/animations'

import { useContacts } from '@/hooks/chathome/useContacts'
import { useFilteredContacts } from '@/hooks/chathome/useFilteredContacts'
import { useCreateContact } from '@/hooks/chathome/useCreateContact'
import { useForwardMessage } from '@/hooks/chathome/useForwardMessage'
import { useContactActions } from '@/hooks/chathome/useContactActions'
import Loading from '@/components/common/Loading/Loading'

const Navbar = dynamic(() => import('@/components/common/Navbar/Navbar'));
const ContactCard = dynamic(() => import('@/components/ui/ContactCard/ContactCard'));
const SearchBar = dynamic(() => import('@/components/common/SearchBar/SearchBar'));
const ForwardModal = dynamic(() => import('@/components/ui/ForwardModal/ForwardModal'));

interface Contact {
  id: string
  peerId?: string
  name: string
  mobile: string
  avatar: string
  pinned: boolean
  blocked?: boolean
  active: boolean
  unread: number
  lastSeen?: string
  lastMessageTime: string
  lastMessage: string
  mobiles?: string[]
  email?: string
  registered?: boolean
  registeredUserId?: string
}

interface Theme {
  wallpaper?: string
  textSize?: string
  primary: string
  secondary?: string
  isDark?: boolean // Added dark mode support
}

interface User {
  name: string
  avatar?: string
  email?: string
}

interface ChatHomeProps {
  user: User
  theme: Theme
  onLogout: () => void
}

export default function ChatHome({ user, theme, onLogout }: ChatHomeProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const { contacts, loading, setContacts } = useContacts()
  const filteredContacts = useFilteredContacts({ contacts, searchQuery })
  const {
    showCreateModal,
    setShowCreateModal,
    newName,
    setNewName,
    newMobiles,
    newEmail,
    setNewEmail,
    createError,
    creating,
    addMobileField,
    updateMobileField,
    removeMobileField,
    submitCreateContact
  } = useCreateContact({ contacts, setContacts })

  const {
    forwardModalData,
    handleForwardMessage,
    handleForwardSubmit
  } = useForwardMessage({ contacts })

  const {
    selectedContact,
    showContactModal,
    handleContactClick,
    handlePinContact,
    handleUnpinContact,
    handleBlockUnblock,
    closeContactModal
  } = useContactActions({ contacts, setContacts })

  const handleSearch = (query: string) => setSearchQuery(query)

  // Dark mode color classes
  const textColor = theme.isDark ? 'text-gray-100' : 'text-gray-800'
  const textSecondary = theme.isDark ? 'text-gray-300' : 'text-gray-600'
  const textMuted = theme.isDark ? 'text-gray-400' : 'text-gray-500'
  const bgCard = theme.isDark ? 'bg-gray-800' : 'bg-white'
  const bgCardHover = theme.isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
  const bgOverlay = theme.isDark ? 'bg-gray-900/80' : 'bg-black/50'
  const borderColor = theme.isDark ? 'border-gray-700' : 'border-gray-200'
  const inputBg = theme.isDark ? 'bg-gray-800 border-gray-600 focus:border-blue-400' : 'bg-white border-gray-200 focus:border-emerald-500'

  if (loading) {
    return (
      <Loading theme={theme} />
    )
  }

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h1 className={`text-3xl font-bold ${textColor} mb-2 ${theme.textSize}`}>
              Chats
            </h1>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 text-white rounded-xl shadow-sm font-medium"
              style={{ backgroundColor: theme.primary }}
            >
              Create Contact
            </motion.button>
          </div>
          <SearchBar
            onSearch={handleSearch}
            placeholder="Search by name or mobile..."
          />
        </motion.div>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-3"
        >
          {filteredContacts.map((contact) => (
            <motion.div key={contact.id} {...fadeIn}>
              <ContactCard
                contact={contact}
                onClick={() => handleContactClick(contact)}
                onPin={handlePinContact}
                onUnpin={handleUnpinContact}
                onForward={handleForwardMessage}
                theme={theme}
              />
            </motion.div>
          ))}
        </motion.div>
        {filteredContacts.length === 0 && !loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className={`text-lg ${textMuted}`}>No contacts found</p>
          </motion.div>
        )}
        {showContactModal && selectedContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 ${bgOverlay} flex items-center justify-center z-50 p-4`}
            onClick={closeContactModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`${bgCard} rounded-3xl p-6 max-w-md w-full shadow-2xl border ${borderColor}`}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className={`text-2xl font-bold ${textColor}`}>Contact Info</h2>
                <button
                  onClick={closeContactModal}
                  className={`${bgCardHover} p-2 rounded-full transition-colors`}
                >
                  <X className={`w-6 h-6 ${textSecondary}`} />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <Image
                    src={selectedContact.avatar || "/logo/logo.png"}
                    alt={selectedContact.name}
                    width={128}
                    height={128}
                    className="w-32 h-32 rounded-full object-cover border-4"
                    style={{ borderColor: theme.secondary || (theme.isDark ? '#374151' : '#e5e7eb') }}
                  />
                  {selectedContact.active && (
                    <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
                  )}
                </div>
                <h3 className={`text-2xl font-bold ${textColor} mb-1`}>
                  {selectedContact.name}
                </h3>
                <p className={`${textSecondary} flex items-center gap-2`}>
                  <Phone className={`w-4 h-4 ${textSecondary}`} />
                  {selectedContact.mobile}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className={`${bgCardHover} flex items-center gap-3 p-3 rounded-xl ${borderColor}`}>
                  <Clock className={`w-5 h-5 ${textMuted}`} />
                  <div>
                    <p className={`${textMuted} text-sm`}>Last Seen</p>
                    <p className={`${textColor} font-medium`}>
                      {selectedContact.lastSeen || 'Never'}
                    </p>
                  </div>
                </div>
                <div className={`${bgCardHover} flex items-center gap-3 p-3 rounded-xl ${borderColor}`}>
                  <CheckCircle className={`w-5 h-5 ${textMuted}`} />
                  <div>
                    <p className={`${textMuted} text-sm`}>Status</p>
                    <p className={`font-medium ${selectedContact.active ? 'text-green-500' : textColor}`}>
                      {selectedContact.active ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    const peer = (selectedContact as any).registeredUserId
                    if (peer) {
                      closeContactModal()
                      router.push(`/chat/${peer}`)
                      return
                    }
                    try {
                      const mobile = (Array.isArray(selectedContact.mobiles) && selectedContact.mobiles[0]) || selectedContact.mobile
                      const res = await fetch('/api/users/by-mobile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ mobile }),
                      })
                      const data = await res.json()
                      if (res.ok && data?.id) {
                        closeContactModal()
                        router.push(`/chat/${data.id}`)
                      } else {
                        closeContactModal()
                        alert('Unable to open chat. Please check mobile number.')
                      }
                    } catch {
                      closeContactModal()
                      alert('Unable to open chat. Please try again.')
                    }
                  }}
                  className="flex-1 py-3 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Phone className="w-5 h-5" />
                  Message
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleBlockUnblock(selectedContact.id)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 shadow-lg ${
                    selectedContact.blocked
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-500 text-white hover:bg-red-600'
                  }`}
                >
                  <Ban className="w-5 h-5" />
                  {selectedContact.blocked ? 'Unblock' : 'Block'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {forwardModalData.visible && (
          <ForwardModal
            contacts={contacts}
            onClose={() => handleForwardSubmit([], '')}
            onForward={handleForwardSubmit}
            theme={theme}
          />
        )}
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`fixed inset-0 ${bgOverlay} flex items-center justify-center z-50 p-4`}
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className={`${bgCard} rounded-3xl p-6 max-w-lg w-full shadow-2xl border ${borderColor}`}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className={`text-2xl font-bold ${textColor}`}>Create Contact</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className={`${bgCardHover} p-2 rounded-full transition-colors`}
                >
                  <X className={`w-6 h-6 ${textSecondary}`} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                    placeholder="Enter contact name"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Mobile Numbers</label>
                  <div className="space-y-2">
                    {newMobiles.map((m, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="tel"
                          value={m}
                          onChange={(e) => updateMobileField(idx, e.target.value)}
                          className={`flex-1 px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                          placeholder="10-digit number"
                        />
                        {newMobiles.length > 1 && (
                          <button
                            onClick={() => removeMobileField(idx)}
                            className="px-3 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addMobileField}
                    className={`${bgCardHover} mt-2 px-3 py-2 rounded-xl ${textSecondary} hover:opacity-80 transition-all`}
                  >
                    Add another number
                  </button>
                </div>

                <div>
                  <label className={`block text-sm font-medium ${textSecondary} mb-2`}>Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className={`w-full px-4 py-3 border-2 rounded-xl transition-colors ${inputBg} ${textColor}`}
                    placeholder="example@domain.com"
                  />
                </div>

                {createError && (
                  <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-xl border border-red-500/30">
                    {createError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitCreateContact}
                    disabled={creating}
                    className="flex-1 py-3 text-white rounded-xl font-medium transition-colors shadow-lg"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {creating ? 'Saving...' : 'Save Contact'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    className={`${bgCardHover} flex-1 py-3 rounded-xl font-medium ${textSecondary} border ${borderColor}`}
                  >
                    Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
