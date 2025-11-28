"use client";
import { useState } from "react";
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

  const handleContactClick = async (contact: Contact) => {
    const peerId = contact.peerId || contact.registeredUserId || contact.id;
    if (peerId) {
      router.push(`/chat/${peerId}`);
      return;
    }

    setSelectedContact(contact);
    setShowContactModal(true);
  };

  const handlePinContact = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: true } : contact
      )
    );
  };

  const handleUnpinContact = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId ? { ...contact, pinned: false } : contact
      )
    );
  };

  const handleBlockUnblock = (contactId: string) => {
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === contactId
          ? { ...contact, blocked: !contact.blocked }
          : contact
      )
    );

    if (selectedContact?.id === contactId) {
      setSelectedContact({
        ...selectedContact,
        blocked: !selectedContact.blocked,
      });
    }
  };

  const closeContactModal = () => {
    setShowContactModal(false);
    setSelectedContact(null);
  };

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
