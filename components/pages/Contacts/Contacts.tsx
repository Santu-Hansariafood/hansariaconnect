"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { fadeIn, staggerContainer } from "@/utils/animations/animations"
import { X, CheckCircle2, CircleUserRound, Pencil, Trash2 } from "lucide-react"

import { FaWhatsapp, FaFacebookF, FaTwitter, FaSms } from "react-icons/fa"
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

export default function Contacts({ user, theme }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([])
  const [manageContact, setManageContact] = useState<Contact | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newName, setNewName] = useState("")
  const [newMobiles, setNewMobiles] = useState<string[]>([""])
  const [newEmail, setNewEmail] = useState("")
  const [error, setError] = useState("")
  const [creating, setCreating] = useState(false)

  const [inviteLoading, setInviteLoading] = useState<string>("")
  const [inviteMessage, setInviteMessage] = useState<string>("")

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
      const aName = (a.name || "").toLowerCase()
      const bName = (b.name || "").toLowerCase()
      if (aName && bName && aName !== bName) return aName.localeCompare(bName)
      const aMobile = (a.mobile || "")
      const bMobile = (b.mobile || "")
      return aMobile.localeCompare(bMobile)
    })

    setFilteredContacts(filtered)
  }, [contacts, searchQuery])

  const buildShareLinks = (contact: Contact) => {
    const origin = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : ""

    const loginUrl = `${origin}/login`
    const text = `Welcome to HansariaConnect! Login here: ${loginUrl}`

    const encoded = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(loginUrl)

    return {
      wa: `https://wa.me/?text=${encoded}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
      x: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
      sms: `sms:${contact.mobile}?&body=${encoded}`,
    }
  }

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

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2 rounded-xl text-white font-medium shadow"
              style={{ backgroundColor: theme.primary }}
            >
              + New Contact
            </button>
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6"
        >
          {filteredContacts.map((c) => {
            const links = buildShareLinks(c)
            return (
              <motion.div key={c.id} {...fadeIn}>
                <div
                  className={`rounded-2xl p-4 shadow-md border transition ${
                    c.registered
                      ? "border-emerald-400 bg-emerald-50"
                      : "border-gray-100 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-4 mb-3">
                      <Image
                        src={c.avatar || "/logo/logo.png"}
                        alt={c.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 rounded-full object-cover border border-gray-200"
                      />
                    <div>
                      <div className="text-lg font-semibold">{c.name}</div>
                      <div className="text-sm text-gray-500">{c.mobile}</div>

                      {c.registered && (
                        <div className="flex items-center text-emerald-600 text-xs mt-1">
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Registered
                        </div>
                      )}
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => setManageContact(c)}
                        className="p-2 border rounded-xl text-gray-700 hover:bg-gray-50"
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setManageContact(c)}
                        className="p-2 border rounded-xl text-red-600 hover:bg-red-50"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {c.registered ? (
                    <button
                      onClick={() => router.push(`/chat/${c.registeredUserId}`)}
                      className="w-full py-2 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium"
                    >
                      Message
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setInviteMessage("Invitation prepared.")}
                        className="w-full py-2 bg-gray-800 text-white rounded-xl font-medium hover:bg-black"
                      >
                        Invite
                      </button>

                      <div className="flex gap-3 mt-3">
                        <Link href={links.wa} target="_blank" className="p-2 bg-green-500 rounded-full text-white">
                          <FaWhatsapp />
                        </Link>
                        <Link href={links.fb} target="_blank" className="p-2 bg-blue-600 rounded-full text-white">
                          <FaFacebookF />
                        </Link>
                        <Link href={links.x} target="_blank" className="p-2 bg-black rounded-full text-white">
                          <FaTwitter />
                        </Link>
                        <Link href={links.sms} className="p-2 bg-gray-500 rounded-full text-white">
                          <FaSms />
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            )
          })}
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
