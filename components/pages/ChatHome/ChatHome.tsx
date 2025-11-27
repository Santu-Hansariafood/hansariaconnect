'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { staggerContainer, fadeIn } from '@/utils/animations/animations'
import { X, Phone, Clock, Ban, CheckCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
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
}

interface User {
  name: string
  avatar?: string
  email?: string
}

interface ForwardModalData {
  visible: boolean
  contact: Contact | null
}

interface ChatHomeProps {
  user: User
  theme: Theme
  onLogout: () => void
}

export default function ChatHome({ user, theme, onLogout }: ChatHomeProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [forwardModalData, setForwardModalData] = useState<ForwardModalData>({
    visible: false,
    contact: null,
  })
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newMobiles, setNewMobiles] = useState<string[]>([''])
  const [newEmail, setNewEmail] = useState('')
  const [createError, setCreateError] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    sortAndFilterContacts(contacts, searchQuery)
  }, [contacts, searchQuery])

  useEffect(() => {
    const loadConversations = async () => {
      try {
        const [convRes, unreadRes] = await Promise.all([
          fetch('/api/conversations', { method: 'GET', credentials: 'include' }),
          fetch('/api/unread-counts', { cache: 'no-store', credentials: 'include' }),
        ]);
        const convData = await convRes.json();
        const unreadData = await unreadRes.json();
        const unreadMap = unreadData?.conversations || {};

        if (Array.isArray(convData?.conversations)) {
          const mapped: Contact[] = convData.conversations.map((c: any) => {
            let lastMessageText = ''
            if (c.lastMessage) {
              if (c.lastMessage.type === 'text') {
                lastMessageText = c.lastMessage.text || ''
              } else if (c.lastMessage.type === 'image') {
                lastMessageText = '📷 Image'
              } else if (c.lastMessage.type === 'video') {
                lastMessageText = '🎥 Video'
              } else if (c.lastMessage.type === 'voice') {
                lastMessageText = '🎤 Voice'
              } else if (c.lastMessage.type === 'pdf') {
                lastMessageText = '📄 PDF'
              } else if (c.lastMessage.type === 'excel') {
                lastMessageText = '📊 Excel'
              } else if (c.lastMessage.type === 'link') {
                lastMessageText = c.lastMessage.linkTitle || '🔗 Link'
              } else {
                lastMessageText = c.lastMessage.text || ''
              }
            }
            
            return {
              id: c.id || c.peerId,
              peerId: c.peerId || c.id,
              name: c.name || c.mobile || 'Unknown',
              mobile: c.mobile || '',
              avatar: c.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
              pinned: false,
              blocked: false,
              active: false,
              unread: unreadMap[c.peerId || c.id] || 0,
              lastSeen: '',
              lastMessageTime: c.lastMessageAt || '',
              lastMessage: lastMessageText,
              mobiles: [c.mobile].filter(Boolean),
              email: '',
              registered: true,
              registeredUserId: c.peerId || c.id,
            }
          })
          setContacts(mapped)
        }
      } catch {}
    }
    loadConversations()
  }, [])

  const sortAndFilterContacts = (contactsList: Contact[], query: string) => {
    let filtered = contactsList

    if (query.trim()) {
      filtered = contactsList.filter(
        (contact) =>
          contact.name.toLowerCase().includes(query.toLowerCase()) ||
          contact.mobile.includes(query)
      )
    }

    const pinned = filtered
      .filter((c) => c.pinned)
      .sort(
        (a, b) =>
          new Date(b.lastMessageTime || '').getTime() -
          new Date(a.lastMessageTime || '').getTime()
      )

    const unpinned = filtered
      .filter((c) => !c.pinned)
      .sort(
        (a, b) =>
          new Date(b.lastMessageTime || '').getTime() -
          new Date(a.lastMessageTime || '').getTime()
      )

    setFilteredContacts([...pinned, ...unpinned])
  }

  const handleSearch = (query: string) => setSearchQuery(query)

  const handleContactClick = (contact: Contact) => {
    const peerId = contact.peerId || contact.registeredUserId || contact.id
    if (peerId) {
      router.push(`/chat/${peerId}`)
    } else {
      setSelectedContact(contact)
      setShowContactModal(true)
    }
  }

  const handlePinContact = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: true } : contact
      )
    )
  }

  const handleUnpinContact = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: false } : contact
      )
    )
  }

  const handleForwardMessage = (contact: any) => {
    setForwardModalData({ visible: true, contact })
  }

  const handleForwardSubmit = (selectedContactIds: string[], message: string) => {
    const text = message.trim()
    if (!text) {
      setForwardModalData({ visible: false, contact: null })
      return
    }
    const byId: Record<string, Contact> = {}
    for (const c of contacts) byId[c.peerId || c.registeredUserId || c.id] = c
    const sendAll = async () => {
      for (const cid of selectedContactIds) {
        const c = contacts.find((x) => x.id === cid) || byId[cid]
        const peer = c?.peerId || c?.registeredUserId || c?.id
        if (!peer) continue
        try {
          await fetch(`/api/messages/${peer}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ type: 'text', text }),
          })
        } catch {}
      }
    }
    sendAll()
    setForwardModalData({ visible: false, contact: null })
  }

  const handleBlockUnblock = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, blocked: !contact.blocked }
          : contact
      )
    )

    if (selectedContact?.id === contactId) {
      setSelectedContact({
        ...selectedContact,
        blocked: !selectedContact.blocked,
      })
    }
  }

  const closeModal = () => {
    setShowContactModal(false)
    setSelectedContact(null)
  }

  const addMobileField = () => setNewMobiles((prev) => [...prev, ''])
  const updateMobileField = (idx: number, value: string) => {
    setNewMobiles((prev) => prev.map((m, i) => (i === idx ? value : m)))
  }
  const removeMobileField = (idx: number) => {
    setNewMobiles((prev) => prev.filter((_, i) => i !== idx))
  }
  const submitCreateContact = async () => {
    setCreateError('')
    const mobilesClean = newMobiles.map((m) => m.replace(/\D/g, '')).filter((m) => m)
    if (!newName.trim()) {
      setCreateError('Name is required')
      return
    }
    if (!mobilesClean.length) {
      setCreateError('Add at least one mobile number')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), mobiles: mobilesClean, email: newEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok && data?.contact) {
        const c = data.contact
        const mapped: Contact = {
          id: c._id,
          name: c.name,
          mobile: Array.isArray(c.mobiles) && c.mobiles.length ? c.mobiles[0] : '',
          avatar: c.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
          pinned: false,
          blocked: false,
          active: false,
          unread: 0,
          lastSeen: '',
          lastMessage: '',
          lastMessageTime: c.updatedAt || c.createdAt || '',
          mobiles: c.mobiles || [],
          email: c.email || '',
          registered: !!c.registered,
        }
        setContacts((prev) => [mapped, ...prev])
        setShowCreateModal(false)
        setNewName('')
        setNewMobiles([''])
        setNewEmail('')
      } else {
        setCreateError(data?.error || 'Failed to create contact')
      }
    } catch {
      setCreateError('Failed to create contact')
    } finally {
      setCreating(false)
    }
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
            <h1
            className={`text-3xl font-bold text-gray-800 mb-2 ${theme.textSize}`}
            >
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

        {filteredContacts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-500 text-lg">No contacts found</p>
          </motion.div>
        )}
        {showContactModal && selectedContact && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Contact Info</h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-4">
                  <img
                    src={selectedContact.avatar}
                    alt={selectedContact.name}
                    className="w-32 h-32 rounded-full object-cover border-4"
                    style={{ borderColor: theme.secondary }}
                  />
                  {selectedContact.active && (
                    <span className="absolute bottom-2 right-2 w-6 h-6 bg-green-500 border-4 border-white rounded-full" />
                  )}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-1">
                  {selectedContact.name}
                </h3>
                <p className="text-gray-600 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {selectedContact.mobile}
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">Last Seen</p>
                    <p className="font-medium text-gray-800">
                      {selectedContact.lastSeen}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <CheckCircle className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="font-medium text-gray-800">
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
                      closeModal()
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
                        closeModal()
                        router.push(`/chat/${data.id}`)
                      } else {
                        closeModal()
                        alert('Unable to open chat. Please check mobile number.')
                      }
                    } catch {
                      closeModal()
                      alert('Unable to open chat. Please try again.')
                    }
                  }}
                  className="flex-1 py-3 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Phone className="w-5 h-5" />
                  Message
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleBlockUnblock(selectedContact.id)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                    selectedContact.blocked
                      ? 'bg-green-500 text-white hover:bg-green-600'
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
            onClose={() =>
              setForwardModalData({ visible: false, contact: null })
            }
            onForward={handleForwardSubmit}
            theme={theme}
          />
        )}

        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Create Contact</h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Numbers</label>
                  <div className="space-y-2">
                    {newMobiles.map((m, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="tel"
                          value={m}
                          onChange={(e) => updateMobileField(idx, e.target.value)}
                          className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 transition-colors"
                          placeholder="10-digit number"
                        />
                        {newMobiles.length > 1 && (
                          <button
                            onClick={() => removeMobileField(idx)}
                            className="px-3 py-2 bg-red-500 text-white rounded-xl"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addMobileField}
                    className="mt-2 px-3 py-2 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200"
                  >
                    Add another number
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 transition-colors"
                    placeholder="example@domain.com"
                  />
                </div>

                {createError && (
                  <p className="text-red-600 text-sm">{createError}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitCreateContact}
                    disabled={creating}
                    className="flex-1 py-3 text-white rounded-xl font-medium transition-colors"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {creating ? 'Saving...' : 'Save Contact'}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-gray-100 rounded-xl font-medium text-gray-700"
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
