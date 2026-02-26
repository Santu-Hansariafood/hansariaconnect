"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type Permissions = {
  contacts: boolean
  groups: boolean
  status: boolean
  attachments: boolean
}

type UserRow = {
  id: string
  mobile: string
  name: string
  avatar: string
  permissions: Permissions
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<UserRow[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      setError("")
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" })
        if (res.status === 401) {
          router.replace("/admin/login")
          return
        }
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error || "Failed to load")
          setLoading(false)
          return
        }
        setUsers(data?.users || [])
      } catch {
        setError("Network error")
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [router])

  const update = async (id: string, next: Permissions) => {
    setSaving(id)
    try {
      const res = await fetch(`/api/admin/users/${id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: next }),
      })
      const data = await res.json()
      if (res.ok && data?.permissions) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, permissions: data.permissions } : u)))
      }
    } finally {
      setSaving(null)
    }
  }

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" })
    } catch {}
    router.replace("/admin/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <button onClick={logout} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700">
            Logout
          </button>
        </div>
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50">
              <div className="col-span-3">User</div>
              <div className="col-span-2 text-center">Contacts</div>
              <div className="col-span-2 text-center">Groups</div>
              <div className="col-span-2 text-center">Status</div>
              <div className="col-span-2 text-center">Attachments</div>
              <div className="col-span-1 text-center">Save</div>
            </div>
            {users.map((u) => (
              <Row
                key={u.id}
                user={u}
                onSave={(p) => update(u.id, p)}
                saving={saving === u.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ user, onSave, saving }: { user: UserRow; onSave: (p: Permissions) => void; saving: boolean }) {
  const [contacts, setContacts] = useState(user.permissions.contacts)
  const [groups, setGroups] = useState(user.permissions.groups)
  const [status, setStatus] = useState(user.permissions.status)
  const [attachments, setAttachments] = useState(user.permissions.attachments)
  useEffect(() => {
    setContacts(user.permissions.contacts)
    setGroups(user.permissions.groups)
    setStatus(user.permissions.status)
    setAttachments(user.permissions.attachments)
  }, [user.permissions])
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center">
      <div className="col-span-3">
        <div className="font-medium text-gray-900">{user.name || user.mobile}</div>
        <div className="text-xs text-gray-500">{user.mobile}</div>
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={contacts} onChange={(e) => setContacts(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={groups} onChange={(e) => setGroups(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={attachments} onChange={(e) => setAttachments(e.target.checked)} />
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          onClick={() => onSave({ contacts, groups, status, attachments })}
          disabled={saving}
          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  )
}
