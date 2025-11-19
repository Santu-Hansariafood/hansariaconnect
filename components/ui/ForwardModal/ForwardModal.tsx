"use client"

import { motion } from "framer-motion"
import { useState, ChangeEvent } from "react"
import { X, Send, Search } from "lucide-react"
import Image from "next/image"

interface Contact {
  id: string
  name: string
  mobile: string
  avatar: string
}

interface Theme {
  primary: string
  textSize?: string
}

interface ForwardModalProps {
  contacts: Contact[]
  onClose: () => void
  onForward: (selectedContacts: string[], message: string) => void
  theme: Theme
}

const ForwardModal: React.FC<ForwardModalProps> = ({
  contacts,
  onClose,
  onForward,
  theme,
}) => {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [message, setMessage] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.mobile.includes(searchQuery)
  )

  const toggleContactSelection = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleForward = () => {
    if (selectedContacts.length > 0 && message.trim()) {
      onForward(selectedContacts, message)
      onClose()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Forward Message</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearchQuery(e.target.value)
            }
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto mb-4 space-y-2">
          {filteredContacts.map((contact) => (
            <motion.div
              key={contact.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleContactSelection(contact.id)}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                selectedContacts.includes(contact.id)
                  ? "bg-emerald-100 border-2 border-emerald-500"
                  : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
              }`}
            >
              <div className="relative">
                <Image
                  src={contact.avatar}
                  alt={contact.name}
                  width={48}
                  height={48}
                  className="rounded-full object-cover"
                />
                {selectedContacts.includes(contact.id) && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{contact.name}</h3>
                <p className="text-sm text-gray-600">{contact.mobile}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="space-y-4">
          <textarea
            placeholder="Enter message to forward..."
            value={message}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setMessage(e.target.value)
            }
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            rows={3}
          />

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleForward}
              disabled={selectedContacts.length === 0 || !message.trim()}
              className={`flex-1 py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 ${
                selectedContacts.length === 0 || !message.trim()
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-emerald-500 text-white hover:bg-emerald-600"
              }`}
            >
              <Send className="w-5 h-5" />
              Forward ({selectedContacts.length})
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ForwardModal
