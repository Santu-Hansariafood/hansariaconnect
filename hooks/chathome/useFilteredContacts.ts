"use client";

import { useEffect, useMemo } from "react";
import { Contact } from "./useContacts";

interface UseFilteredContactsProps {
  contacts: Contact[];
  searchQuery: string;
}

export const useFilteredContacts = ({
  contacts,
  searchQuery,
}: UseFilteredContactsProps) => {
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    if (searchQuery.trim()) {
      filtered = contacts.filter(
        (contact) =>
          contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          contact.mobile.includes(searchQuery)
      );
    }

    const pinned = filtered
      .filter((c) => c.pinned)
      .sort(
        (a, b) =>
          new Date(b.lastMessageTime || "").getTime() -
          new Date(a.lastMessageTime || "").getTime()
      );

    const unpinned = filtered
      .filter((c) => !c.pinned)
      .sort(
        (a, b) =>
          new Date(b.lastMessageTime || "").getTime() -
          new Date(a.lastMessageTime || "").getTime()
      );

    return [...pinned, ...unpinned];
  }, [contacts, searchQuery]);

  return filteredContacts;
};
