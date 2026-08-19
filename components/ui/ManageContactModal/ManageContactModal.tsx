"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"

type Theme = { primary?: string }

type Contact = {
  id: string
  name: string
}

interface Props {
  contact: Contact | null
  onClose: () => void
  onSave: (name: string) => Promise<void> | void
  onDelete: () => Promise<void> | void
  theme?: Theme
}

const ManageContactModal: React.FC<Props> = ({ contact, onClose, onSave, onDelete, theme }) => {
  const [name, setName] = useState<string>(contact?.name || "")
  const [error, setError] = useState<string>("")
  const [saving, setSaving] = useState<boolean>(false)

  const handleSave = async () => {
    setError("")
    const next = name.trim()
    if (!next) { setError("Name is required"); return }
    setSaving(true)
    try { await onSave(next); onClose() } catch { setError("Failed to save") }
    setSaving(false)
  }

  const handleDelete = async () => {
    setError("")
    try { await onDelete(); onClose() } catch { setError("Failed to delete") }
  }

  if (!contact) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Manage Contact</h3>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border rounded-xl" placeholder="Enter name" />
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-white" style={{ backgroundColor: theme?.primary || "#10b981" }}>{saving ? 'Saving...' : 'Save'}</button>
          <button onClick={handleDelete} className="ml-auto px-4 py-2 rounded-xl text-white bg-red-600">Delete</button>
        </div>
      </motion.div>
    </div>
  )
}

export default ManageContactModal
