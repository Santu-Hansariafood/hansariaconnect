'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { contacts as initialContacts } from '@/data/mockData'
import { staggerContainer, fadeIn } from '@/utils/animations/animations'
import { X, Phone, Clock, Ban, CheckCircle } from 'lucide-react'
import dynamic from 'next/dynamic'
const Navbar = dynamic(() => import('@/components/common/Navbar/Navbar'));
const ContactCard = dynamic(() => import('@/components/ui/ContactCard/ContactCard'));
const SearchBar = dynamic(() => import('@/components/common/SearchBar/SearchBar'));
const ForwardModal = dynamic(() => import('@/components/ui/ForwardModal/ForwardModal'));

interface Contact {
  id: string
  name: string
  mobile: string
  avatar: string
  pinned?: boolean
  blocked?: boolean
  active?: boolean
  lastSeen?: string
  lastMessageTime?: string
}

interface Theme {
  wallpaper?: string
  textSize?: string
  primary?: string
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
  const [contacts, setContacts] = useState<Contact[]>(initialContacts)
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)
  const [forwardModalData, setForwardModalData] = useState<ForwardModalData>({
    visible: false,
    contact: null,
  })

  useEffect(() => {
    sortAndFilterContacts(contacts, searchQuery)
  }, [contacts, searchQuery])

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
    setSelectedContact(contact)
    setShowContactModal(true)
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

  const handleForwardMessage = (contact: Contact) => {
    setForwardModalData({ visible: true, contact })
  }

  const handleForwardSubmit = (selectedContactIds: string[], message: string) => {
    console.log('Forwarding message to:', selectedContactIds, 'Message:', message)
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

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} onLogout={onLogout} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1
            className={`text-3xl font-bold text-gray-800 mb-2 ${theme.textSize}`}
          >
            Chats
          </h1>
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
            <motion.div key={contact.id} variants={fadeIn}>
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
                  onClick={() => {
                    closeModal()
                    router.push(`/chat/${selectedContact.id}`)
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
      </div>
    </div>
  )
}
