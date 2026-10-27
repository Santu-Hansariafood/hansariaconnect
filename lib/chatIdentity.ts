/*
 * A DM's chat id is the peer's user id, but the same value arrives under
 * different field names depending on the endpoint (`peerId` for conversations,
 * `registeredUserId` for contacts). Unregistered contacts have neither, so the
 * contact document id is the last resort. Groups carry a plain `id`.
 *
 * This used to be spelled out inline in a dozen places with two different field
 * orders, which made it easy to get subtly out of sync. Keep it here instead.
 */
export interface ChatIdentifiable {
  id?: string | null;
  _id?: unknown;
  peerId?: string | null;
  registeredUserId?: string | null;
}

export const resolveChatId = (contact?: ChatIdentifiable | null): string => {
  if (!contact) return "";
  const candidate =
    contact.registeredUserId || contact.peerId || contact.id || contact._id;
  return candidate ? String(candidate) : "";
};
