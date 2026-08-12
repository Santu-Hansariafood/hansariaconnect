"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fadeIn, staggerContainer } from "@/utils/animations/animations"
import { X, CheckCircle2, CircleUserRound, Pencil, Trash2 } from "lucide-react"
import { useSocket } from "@/hooks/useSocket"

import { FaGoogle, FaWhatsapp, FaFacebookF, FaTwitter, FaSms } from "react-icons/fa"
import Link from "next/link"

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"))
const ContactCard = dynamic(() => import("@/components/ui/ContactCard/ContactCard"))
const SearchBar = dynamic(() => import("@/components/common/SearchBar/SearchBar"))
const ManageContactModal = dynamic(() => import("@/components/ui/ManageContactModal/ManageContactModal"))

type Theme = { wallpaper?: string; textSize?: string; primary?: string }
type User = any

type Contact = {
  id: string
  name: string
  mobile: string
  avatar: string
  pinned?: boolean
  blocked?: boolean
  lastMessageTime?: string
  mobiles?: string[]
  email?: string
  registered?: boolean
  registeredUserId?: string
  registeredProfile?: { name?: string; photo?: string } | null
}

type Props = { user: User; theme: Theme }

// Extend Contact type to include share links
interface ContactWithLinks extends Contact {
  shareLinks?: { wa: string; fb: string; x: string; sms: string }
  shareLinksLoading?: boolean
  online?: boolean
}

export default function Contacts({ user, theme }: Props) {
  const router = useRouter()
  const { onlineUserIds } = useSocket()
  const [searchQuery, setSearchQuery] = useState("")
  const [contacts, setContacts] = useState<ContactWithLinks[]>([])
  const [filteredContacts, setFilteredContacts] = useState<ContactWithLinks[]>([])
  const [manageContact, setManageContact] = useState<Contact | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [newMobiles, setNewMobiles] = useState<string[]>([""])
  const [newEmail, setNewEmail] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  const [inviteLoading, setInviteLoading] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState<string>("")
  const [syncing, setSyncing] = useState(false)
  const googleAuthUrl = "/api/google/contacts/auth"

  useEffect(() => {
    setContacts(prev => prev.map(c => ({
      ...c,
      online: c.registeredUserId ? onlineUserIds.includes(c.registeredUserId) : false
    })))
    setFilteredContacts(prev => prev.map(c => ({
      ...c,
      online: c.registeredUserId ? onlineUserIds.includes(c.registeredUserId) : false
    })))
  }, [onlineUserIds])

  // Function to load share links for a contact
  const loadShareLinks = async (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, shareLinksLoading: true } : c
      )
    )

    const contact = contacts.find((c) => c.id === contactId)
    if (!contact) return

    const origin = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : ""

    // Get personalized SMS text from API
    let text = `Welcome to HansariaConnect! Login here: ${origin}/login`
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobiles: [contact.mobile] }),
      })
      const data = await res.json()
      if (data.smsText) text = data.smsText
    } catch {}

    const encoded = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(origin + "/login")

    const shareLinks = {
      wa: `https://wa.me/?text=${encoded}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
      x: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
      sms: `sms:${contact.mobile}?&body=${encoded}`,
    }

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, shareLinks, shareLinksLoading: false } : c
      )
    )
  }

  // Auto sync Google Contacts on mount if tokens exist
  useEffect(() => {
    const autoSync = async () => {
      setSyncing(true)
      try {
        await fetch("/api/google/contacts/sync", {
          method: "POST",
          credentials: "include",
        })
        // Refresh contacts list
        const res = await fetch("/api/contacts", { cache: "no-store", credentials: "include" })
        const data = await res.json()

        if (Array.isArray(data?.contacts)) {
          const mapped = data.contacts.map((c: any) => ({
            id: c._id,
            name: (c.registeredProfile?.name || c.name),
            mobile: c.mobiles?.[0] || "",
            avatar:
              c.registeredProfile?.photo || c.avatar ||
              "/logo/logo.png",
            pinned: false,
            blocked: false,
            lastMessageTime: c.updatedAt || c.createdAt || "",
            mobiles: c.mobiles || [],
            email: c.email || "",
            registered: !!c.registered,
            registeredUserId: c.registeredUserId || "",
            registeredProfile: c.registeredProfile || null,
          }))

          setContacts(mapped)
        }
      } catch (err) {
        // Ignore errors (e.g., no tokens)
      } finally {
        setSyncing(false)
      }
    }
    autoSync()
  }, [])

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const res = await fetch("/api/contacts", { cache: "no-store", credentials: "include" })
        const data = await res.json()

        if (Array.isArray(data?.contacts)) {
          const mapped = data.contacts.map((c: any) => ({
            id: c._id,
            name: (c.registeredProfile?.name || c.name),
            mobile: c.mobiles?.[0] || "",
            avatar:
              c.registeredProfile?.photo || c.avatar ||
              "/logo/logo.png",
            pinned: false,
            blocked: false,
            lastMessageTime: c.updatedAt || c.createdAt || "",
            mobiles: c.mobiles || [],
            email: c.email || "",
            registered: !!c.registered,
            registeredUserId: c.registeredUserId || "",
            registeredProfile: c.registeredProfile || null,
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

    filtered = [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const aName = (a.name || "").trim().toLowerCase()
      const bName = (b.name || "").trim().toLowerCase()
      if (aName && bName && aName !== bName) return aName.localeCompare(bName)
      if (aName && !bName) return -1
      if (!aName && bName) return 1
      const aMobile = (a.mobile || "")
      const bMobile = (b.mobile || "")
      return aMobile.localeCompare(bMobile)
    })

    setFilteredContacts(filtered)
  }, [contacts, searchQuery])

  const submitCreate = async () => {
    setError("")
    const cleanMobiles = newMobiles.map((m) => m.replace(/\D/g, "")).filter(Boolean)

    if (!newName.trim()) return setError("Name is required")
    if (!cleanMobiles.length) return setError("At least one mobile number required")

    setCreating(true)

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          mobiles: cleanMobiles,
          email: newEmail.trim(),
        }),
      })

      const data = await res.json()
      if (res.ok && data.contact) {
        setContacts((prev) => [
          {
            id: data.contact._id,
            name: data.contact.name,
            mobile: data.contact.mobiles?.[0] || "",
            avatar:
              "/logo/logo.png",
            registered: false,
            mobiles: data.contact.mobiles,
            email: data.contact.email,
          },
          ...prev,
        ])

        setShowCreateModal(false)
        setNewName("")
        setNewMobiles([""])
        setNewEmail("")
      } else {
        setError(data?.error || "Failed to create contact")
      }
    } catch {
      setError("Failed to create contact")
    }

    setCreating(false)
  }

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between">
            <h1 className={`text-3xl font-bold ${theme.textSize}`}>Contacts</h1>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => window.location.href = googleAuthUrl}
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm border border-slate-200 transition hover:bg-slate-50"
              >
                <FaGoogle className="w-4 h-4" />
                Import from Google
                {syncing && <span className="ml-2 text-xs text-slate-500">Syncing...</span>}
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
              >
                <CircleUserRound className="w-4 h-4" />
                <span>New Contact</span>
              </button>
            </div>
          </div>

          <SearchBar
            onSearch={setSearchQuery}
            placeholder="Search name or mobile..."
          />
        </motion.div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="space-y-4 mt-6"
        >
          {inviteMessage && (
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              {inviteMessage}
            </div>
          )}

          {filteredContacts.length > 0 ? (
            filteredContacts.map((c) => (
              <motion.div key={c.id} {...fadeIn}>
                <div className="rounded-3xl p-5 shadow-sm border border-gray-200 bg-white transition hover:shadow-lg">
                  <div className="flex items-center gap-4">
                    <div className="relative shrink-0">
                      <Image
                        src={c.avatar || "/logo/logo.png"}
                        alt={c.name}
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-full object-cover"
                      />
                      {c.registered && c.online && (
                        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-lg font-semibold text-gray-900 truncate">{c.name}</p>
                          <p className="text-sm text-gray-500 truncate">{c.email || c.mobile}</p>
                        </div>
                        {c.registered && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${c.online ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                            {c.online ? "Online" : "Offline"}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {c.registered ? (
                          <button
                            onClick={() => router.push(`/chat/${c.registeredUserId}`)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#00a884] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#008069]"
                          >
                            <FaWhatsapp className="w-4 h-4" />
                            Send Message
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              if (!c.shareLinks && !c.shareLinksLoading) loadShareLinks(c.id)
                              setInviteMessage("Invitation ready. Share the contact link below.")
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black"
                            disabled={c.shareLinksLoading}
                          >
                            {c.shareLinksLoading ? "Preparing invite..." : "Invite to Hansaria"}
                          </button>
                        )}
                        <button
                          onClick={() => setManageContact(c)}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                        >
                          <Pencil className="w-4 h-4" />
                          Manage
                        </button>
                      </div>

                      {c.shareLinks && (
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="text-xs uppercase tracking-[0.15em] text-gray-400">Share via</span>
                          <Link href={c.shareLinks.wa} target="_blank" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white">
                            <FaWhatsapp />
                          </Link>
                          <Link href={c.shareLinks.fb} target="_blank" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white">
                            <FaFacebookF />
                          </Link>
                          <Link href={c.shareLinks.x} target="_blank" className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white">
                            <FaTwitter />
                          </Link>
                          <Link href={c.shareLinks.sms} className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-500 text-white">
                            <FaSms />
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
              <p className="text-lg font-semibold text-gray-900">No contacts found yet</p>
              <p className="mt-2 text-sm">Add your first contact or import from Google to start chatting.</p>
            </div>
          )}
        </motion.div>
        {filteredContacts.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-lg">
            No contacts found
          </div>
        )}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-white max-w-lg w-full p-6 rounded-3xl shadow-xl"
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-bold">Create Contact</h2>
                <button onClick={() => setShowCreateModal(false)}>
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-4 py-3 mt-1 border rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Mobile Numbers
                  </label>

                  <div className="space-y-2 mt-1">
                    {newMobiles.map((m, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="tel"
                          value={m}
                          onChange={(e) =>
                            setNewMobiles((prev) =>
                              prev.map((x, i) => (i === index ? e.target.value : x))
                            )
                          }
                          className="flex-1 px-4 py-3 border rounded-xl"
                          placeholder="10-digit number"
                        />
                        {newMobiles.length > 1 && (
                          <button
                            onClick={() =>
                              setNewMobiles((prev) =>
                                prev.filter((_, i) => i !== index)
                              )
                            }
                            className="px-3 py-2 bg-red-500 text-white rounded-xl"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setNewMobiles([...newMobiles, ""])}
                    className="mt-2 px-3 py-2 bg-gray-100 rounded-xl"
                  >
                    Add another number
                  </button>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-3 mt-1 border rounded-xl"
                    placeholder="example@mail.com"
                  />
                </div>

                {error && <p className="text-red-600">{error}</p>}

                <div className="flex gap-4 pt-3">
                  <button
                    onClick={submitCreate}
                    className="flex-1 py-3 text-white rounded-xl"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {creating ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-gray-200 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {manageContact && (
          <ManageContactModal
            contact={{ id: manageContact.id, name: manageContact.name }}
            onClose={() => setManageContact(null)}
            onSave={async (name) => {
              try {
                const res = await fetch('/api/contacts', {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ id: manageContact.id, name })
                })
                const data = await res.json()
                if (res.ok && data?.contact) {
                  setContacts((prev) => prev.map((ct) => ct.id === manageContact.id ? { ...ct, name } : ct))
                  setFilteredContacts((prev) => prev.map((ct) => ct.id === manageContact.id ? { ...ct, name } : ct))
                }
              } catch {}
            }}
            onDelete={async () => {
              try {
                const res = await fetch('/api/contacts', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ id: manageContact.id })
                })
                const data = await res.json()
                if (res.ok && data?.deleted) {
                  setContacts((prev) => prev.filter((ct) => ct.id !== manageContact.id))
                  setFilteredContacts((prev) => prev.filter((ct) => ct.id !== manageContact.id))
                }
              } catch {}
            }}
            theme={theme}
          />
        )}
      </div>
    </div>
  )
}
