"use client";
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Contact } from "./useContacts";

interface UseContactActionsProps {
  contacts: Contact[];
  setContacts: React.Dispatch<React.SetStateAction<Contact[]>>;
}

export const useContactActions = ({
  contacts,
  setContacts,
}: UseContactActionsProps) => {
  const router = useRouter();
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  const handleContactClick = useCallback(async (contact: Contact) => {
    const peerId = contact.peerId || contact.registeredUserId || contact.id;
    if (peerId) {
      router.push(`/chat/${peerId}`);
      return;
    }

    setSelectedContact(contact);
    setShowContactModal(true);
  }, [router]);

  const handlePinContact = useCallback((contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: true } : contact
      )
    );
  }, [setContacts]);

  const handleUnpinContact = useCallback((contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: false } : contact
      )
    );
  }, [setContacts]);

  const handleBlockUnblock = useCallback((contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, blocked: !contact.blocked }
          : contact
      )
    );

    setSelectedContact((current) =>
      current?.id === contactId
        ? { ...current, blocked: !current.blocked }
        : current
    );
  }, [setContacts]);

  const closeContactModal = useCallback(() => {
    setShowContactModal(false);
    setSelectedContact(null);
  }, []);

  return {
    selectedContact,
    showContactModal,
    handleContactClick,
    handlePinContact,
    handleUnpinContact,
    handleBlockUnblock,
    closeContactModal,
  };
};
