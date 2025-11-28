"use client";

import { useState } from "react";
import { Contact } from "./useContacts";

interface UseCreateContactProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
}

export const useCreateContact = ({
  contacts,
  setContacts,
}: UseCreateContactProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobiles, setNewMobiles] = useState<string[]>([""]);
  const [newEmail, setNewEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const addMobileField = () => setNewMobiles((prev) => [...prev, ""]);

  const updateMobileField = (idx: number, value: string) => {
    setNewMobiles((prev) => prev.map((m, i) => (i === idx ? value : m)));
  };

  const removeMobileField = (idx: number) => {
    setNewMobiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitCreateContact = async () => {
    setCreateError("");
    const mobilesClean = newMobiles
      .map((m) => m.replace(/\D/g, ""))
      .filter((m) => m);

    if (!newName.trim()) {
      setCreateError("Name is required");
      return;
    }
    if (!mobilesClean.length) {
      setCreateError("Add at least one mobile number");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          mobiles: mobilesClean,
          email: newEmail.trim(),
        }),
      });
      const data = await res.json();

      if (res.ok && data?.contact) {
        const c = data.contact;
        const mapped: Contact = {
          id: c._id,
          name: c.name,
          mobile:
            Array.isArray(c.mobiles) && c.mobiles.length ? c.mobiles[0] : "",
          avatar: c.avatar || "/logo/logo.png",
          pinned: false,
          blocked: false,
          active: false,
          unread: 0,
          lastSeen: "",
          lastMessage: "",
          lastMessageTime: c.updatedAt || c.createdAt || "",
          mobiles: c.mobiles || [],
          email: c.email || "",
          registered: !!c.registered,
        };
        setContacts((prev) => [mapped, ...prev]);
        resetForm();
      } else {
        setCreateError(data?.error || "Failed to create contact");
      }
    } catch {
      setCreateError("Failed to create contact");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setShowCreateModal(false);
    setNewName("");
    setNewMobiles([""]);
    setNewEmail("");
  };

  return {
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
    submitCreateContact,
    resetForm,
  };
};
