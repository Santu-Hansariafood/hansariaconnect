"use client";

import { useMemo } from "react";
import { Contact } from "./useContacts";

export type ChatFilter = "all" | "unread" | "groups" | "me";

interface UseFilteredContactsProps {
  contacts: Contact[];
  searchQuery: string;
  filter?: ChatFilter;
}

export const useFilteredContacts = ({
  contacts,
  searchQuery,
  filter = "all",
}: UseFilteredContactsProps) => {
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (contact) =>
          contact.name.toLowerCase().includes(q) ||
          contact.mobile.includes(searchQuery),
      );
    }

    if (filter === "unread") {
      filtered = filtered.filter((c) => c.unread > 0);
    } else if (filter === "groups") {
      filtered = filtered.filter((c) => c.isGroup);
    } else if (filter === "me") {
      filtered = filtered.filter((c) => c.lastMessageFromMe);
    }

    const sortByTime = (a: Contact, b: Contact) => {
      const ta = new Date(a.lastMessageTime || 0).getTime();
      const tb = new Date(b.lastMessageTime || 0).getTime();
      return tb - ta;
    };

    const pinned = filtered.filter((c) => c.pinned).sort(sortByTime);
    const unpinned = filtered.filter((c) => !c.pinned).sort(sortByTime);

    return [...pinned, ...unpinned];
  }, [contacts, searchQuery, filter]);

  return filteredContacts;
};
