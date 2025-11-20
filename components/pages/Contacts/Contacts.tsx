"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import { fadeIn, staggerContainer } from "@/utils/animations/animations"
import { X, Send } from "lucide-react"

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"))
const ContactCard = dynamic(() => import("@/components/ui/ContactCard/ContactCard"))
const SearchBar = dynamic(() => import("@/components/common/SearchBar/SearchBar"))

type Theme = { wallpaper?: string; textSize?: string; primary?: string }
type User = any

type Contact = {
  id: string
  name: string
  mobile: string
  avatar: string
  pinned?: boolean
  blocked?: boolean
  active?: boolean
  lastSeen?: string
  lastMessageTime?: string
  mobiles?: string[]
  email?: string
  registered?: boolean
}

type Props = { user: User; theme: Theme }

export default function Contacts({ user, theme }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [newMobiles, setNewMobiles] = useState<string[]>([""])
  const [newEmail, setNewEmail] = useState("")
  const [createError, setCreateError] = useState("")
  const [creating, setCreating] = useState(false)
  const [inviteLoading, setInviteLoading] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState<string>("")

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const res = await fetch("/api/contacts")
        const data = await res.json()
        if (Array.isArray(data?.contacts)) {
          const mapped: Contact[] = data.contacts.map((c: any) => ({
            id: c._id,
            name: c.name,
            mobile: Array.isArray(c.mobiles) && c.mobiles.length ? c.mobiles[0] : "",
            avatar:
              c.avatar ||
              "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
            pinned: false,
            blocked: false,
            active: false,
            lastSeen: "",
            lastMessageTime: c.updatedAt || c.createdAt || "",
            mobiles: c.mobiles || [],
            email: c.email || "",
            registered: !!c.registered,
          }))
          setContacts(mapped)
        }
      } catch {}
    }
    loadContacts()
  }, [])

  useEffect(() => {
    let filtered = contacts
    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.mobile.includes(searchQuery)
      )
    }
    const pinned = filtered.filter((c) => c.pinned)
    const unpinned = filtered.filter((c) => !c.pinned)
    setFilteredContacts([...pinned, ...unpinned])
  }, [contacts, searchQuery])

  const handleInvite = async (contact: Contact) => {
    setInviteMessage("")
    setInviteLoading(contact.id)
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobiles: contact.mobiles || [contact.mobile], name: contact.name }),
      })
      const data = await res.json()
      if (res.ok && data?.success) {
        setInviteMessage("Invite ready")
      } else {
        setInviteMessage(data?.error || "Failed to prepare invite")
      }
    } catch {
      setInviteMessage("Failed to prepare invite")
    } finally {
      setInviteLoading("")
      setTimeout(() => setInviteMessage(""), 2500)
    }
  }

  const buildShare = (contact: Contact) => {
    const origin = typeof window !== "undefined" ? window.location.origin : ""
    const loginUrl = `${origin}/login`
    const text = `Join HansariaConnect to chat with me. Login here: ${loginUrl}`
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(loginUrl)
    const wa = `https://wa.me/?text=${encodedText}`
    const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`
    const x = `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`
    const sms = `sms:?&body=${encodedText}`
    return { wa, fb, x, sms }
  }

  const addMobileField = () => setNewMobiles((prev) => [...prev, ""])
  const updateMobileField = (idx: number, value: string) => {
    setNewMobiles((prev) => prev.map((m, i) => (i === idx ? value : m)))
  }
  const removeMobileField = (idx: number) => {
    setNewMobiles((prev) => prev.filter((_, i) => i !== idx))
  }
  const submitCreateContact = async () => {
    setCreateError("")
    const mobilesClean = newMobiles.map((m) => m.replace(/\D/g, "")).filter((m) => m)
    if (!newName.trim()) {
      setCreateError("Name is required")
      return
    }
    if (!mobilesClean.length) {
      setCreateError("Add at least one mobile number")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), mobiles: mobilesClean, email: newEmail.trim() }),
      })
      const data = await res.json()
      if (res.ok && data?.contact) {
        const c = data.contact
        const mapped: Contact = {
          id: c._id,
          name: c.name,
          mobile: Array.isArray(c.mobiles) && c.mobiles.length ? c.mobiles[0] : "",
          avatar:
            c.avatar ||
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop",
          pinned: false,
          blocked: false,
          active: false,
          lastSeen: "",
          lastMessageTime: c.updatedAt || c.createdAt || "",
          mobiles: c.mobiles || [],
          email: c.email || "",
          registered: !!c.registered,
        }
        setContacts((prev) => [mapped, ...prev])
        setShowCreateModal(false)
        setNewName("")
        setNewMobiles([""])
        setNewEmail("")
      } else {
        setCreateError(data?.error || "Failed to create contact")
      }
    } catch {
      setCreateError("Failed to create contact")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className={`text-3xl font-bold text-gray-800 mb-2 ${theme.textSize}`}>Contacts</h1>
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
          <SearchBar onSearch={setSearchQuery} placeholder="Search by name or mobile..." />
        </motion.div>

        <motion.div variants={staggerContainer} initial="hidden" animate="show" className="grid grid-cols-1 gap-3">
          {filteredContacts.map((contact) => (
            <motion.div key={contact.id} variants={fadeIn}>
              <div className="bg-white rounded-2xl p-4 shadow-md">
                <ContactCard
                  contact={contact as any}
                  onClick={() => {}}
                  onPin={() => {}}
                  onUnpin={() => {}}
                  onForward={() => {}}
                  theme={{ primary: theme.primary || "#10b981", textSize: theme.textSize }}
                  showContextMenu={false}
                />
                {!contact.registered && (
                  <div className="mt-3 flex items-center gap-3">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleInvite(contact)}
                      disabled={inviteLoading === contact.id}
                      className="px-4 py-2 text-white rounded-xl font-medium"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {inviteLoading === contact.id ? "Preparing..." : "Invite"}
                    </motion.button>
                    {(() => {
                      const { wa, fb, x, sms } = buildShare(contact)
                      return (
                        <div className="flex items-center gap-2">
                          <a href={wa} target="_blank" className="px-3 py-2 bg-green-500 text-white rounded-xl text-xs">WA</a>
                          <a href={fb} target="_blank" className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs">FB</a>
                          <a href={x} target="_blank" className="px-3 py-2 bg-black text-white rounded-xl text-xs">X</a>
                          <a href={sms} className="px-3 py-2 bg-gray-700 text-white rounded-xl text-xs">SMS</a>
                        </div>
                      )
                    })()}
                    {inviteMessage && inviteLoading === "" && (
                      <span className="text-sm text-gray-600">{inviteMessage}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {filteredContacts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
            <p className="text-gray-500 text-lg">No contacts found</p>
          </motion.div>
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
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
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
                          <button onClick={() => removeMobileField(idx)} className="px-3 py-2 bg-red-500 text-white rounded-xl">
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <button onClick={addMobileField} className="mt-2 px-3 py-2 bg-gray-100 rounded-xl text-gray-700 hover:bg-gray-200">
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
                {createError && <p className="text-red-600 text-sm">{createError}</p>}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={submitCreateContact}
                    disabled={creating}
                    className="flex-1 py-3 text-white rounded-xl font-medium transition-colors"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {creating ? "Saving..." : "Save Contact"}
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