"use client";

import { useState, useCallback } from "react";
import type { Contact } from "./useContacts";
import { resolveChatId } from "@/lib/chatIdentity";

type ForwardableContact = {
  id: string;
  name?: string;
  avatar?: string;
  peerId?: string;
  registeredUserId?: string;
  mobile?: string;
};

interface ForwardModalData {
  visible: boolean;
  contact: ForwardableContact | null;
}

interface UseForwardMessageProps {
  contacts: Contact[];
}

export const useForwardMessage = ({ contacts }: UseForwardMessageProps) => {
  const [forwardModalData, setForwardModalData] = useState<ForwardModalData>({
    visible: false,
    contact: null,
  });

  const handleForwardMessage = useCallback((contact: ForwardableContact) => {
    setForwardModalData({ visible: true, contact });
  }, []);

  const handleForwardSubmit = useCallback(
    async (selectedContactIds: string[], message: string) => {
      const text = message.trim();
      if (!text) {
        setForwardModalData({ visible: false, contact: null });
        return;
      }

      const byId: Record<string, Contact> = {};
      for (const c of contacts) {
        byId[resolveChatId(c)] = c;
      }

      const sendAll = async () => {
        for (const cid of selectedContactIds) {
          const c = contacts.find((x) => x.id === cid) || byId[cid];
          const peer = resolveChatId(c);
          if (!peer) continue;

          try {
            await fetch(`/api/messages/${peer}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ type: "text", text }),
            });
          } catch {}
        }
      };

      await sendAll();
      setForwardModalData({ visible: false, contact: null });
    },
    [contacts],
  );

  const closeForwardModal = useCallback(() => {
    setForwardModalData({ visible: false, contact: null });
  }, []);

  return {
    forwardModalData,
    handleForwardMessage,
    handleForwardSubmit,
    closeForwardModal,
  };
};
