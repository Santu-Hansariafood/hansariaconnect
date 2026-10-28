"use client";

import { useState } from "react";
import { Contact } from "./useContacts";
import {
  EMAIL_REGEX,
  isValidIndianMobile,
  isValidPersonName,
  normalizeEmailInput,
  normalizeIndianMobileInput,
  normalizeNameInput,
} from "@/utils/validation/formInputs";

interface UseCreateContactProps {
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
}

export const useCreateContact = ({
  setContacts,
}: UseCreateContactProps) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobiles, setNewMobiles] = useState<string[]>([""]);
  const [newEmail, setNewEmail] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const setNameInput = (value: string) => setNewName(normalizeNameInput(value));
  const setEmailInput = (value: string) =>
    setNewEmail(normalizeEmailInput(value));

  const addMobileField = () => setNewMobiles((prev) => [...prev, ""]);

  const updateMobileField = (idx: number, value: string) => {
    setNewMobiles((prev) =>
      prev.map((mobile, i) =>
        i === idx ? normalizeIndianMobileInput(value) : mobile,
      ),
    );
  };

  const removeMobileField = (idx: number) => {
    setNewMobiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitCreateContact = async () => {
    setCreateError("");
    const name = normalizeNameInput(newName).trim();
    const email = normalizeEmailInput(newEmail);
    const mobilesClean = newMobiles.filter(Boolean);

    if (!name) {
      setCreateError("Name is required");
      return;
    }
    if (!isValidPersonName(name)) {
      setCreateError(
        "Enter a name using letters, spaces, apostrophes, or hyphens.",
      );
      return;
    }
    if (!mobilesClean.length) {
      setCreateError("Add at least one mobile number");
      return;
    }
    if (mobilesClean.some((mobile) => !isValidIndianMobile(mobile))) {
      setCreateError(
        "Each mobile number must be 10 digits and start with 6, 7, 8, or 9.",
      );
      return;
    }
    if (email && !EMAIL_REGEX.test(email)) {
      setCreateError("Enter a valid email address.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          mobiles: mobilesClean,
          email,
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
    setNewName: setNameInput,
    newMobiles,
    newEmail,
    setNewEmail: setEmailInput,
    createError,
    creating,
    addMobileField,
    updateMobileField,
    removeMobileField,
    submitCreateContact,
    resetForm,
  };
};
