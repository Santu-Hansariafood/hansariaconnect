"use client";

import { useState, useEffect, Suspense, useMemo } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fadeIn, staggerContainer } from "@/utils/animations/animations";
import {
  X,
  CircleUserRound,
  Pencil,
  MessageSquare,
  Plus,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";
import { preloadLastSeenForUsers, formatLastSeenText } from "@/hooks/useLastSeen";
import Loading from "@/components/common/Loading/Loading";

declare global {
  interface Navigator {
    contacts?: {
      select: (
        properties: string[],
        options?: { multiple?: boolean },
      ) => Promise<any[]>;
    };
  }
}

import {
  FaGoogle,
  FaWhatsapp,
  FaFacebookF,
  FaTwitter,
  FaSms,
} from "react-icons/fa";
import Link from "next/link";

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"));
const SearchBar = dynamic(
  () => import("@/components/common/SearchBar/SearchBar"),
);
const ManageContactModal = dynamic(
  () => import("@/components/ui/ManageContactModal/ManageContactModal"),
);

type Theme = { wallpaper?: string; textSize?: string; primary?: string };
type User = any;

type Contact = {
  id: string;
  name: string;
  mobile: string;
  avatar: string;
  pinned?: boolean;
  blocked?: boolean;
  lastMessageTime?: string;
  mobiles?: string[];
  email?: string;
  registered?: boolean;
  registeredUserId?: string;
  registeredProfile?: { name?: string; photo?: string } | null;
};

interface ContactWithLinks extends Contact {
  shareLinks?: { wa: string; fb: string; x: string; sms: string };
  shareLinksLoading?: boolean;
  online?: boolean;
  lastSeenTime?: string | null;
  unread?: number;
}

type Props = { user: User; theme: Theme };

export default function Contacts({ user, theme }: Props) {
  const router = useRouter();
  const { onlineUserIds, addListener, removeListener } = useSocket();
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<ContactWithLinks[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<ContactWithLinks[]>(
    [],
  );
  const [manageContact, setManageContact] = useState<Contact | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMobiles, setNewMobiles] = useState<string[]>([""]);
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const [inviteLoading, setInviteLoading] = useState<string>("");
  const [inviteMessage, setInviteMessage] = useState<string>("");
  const [googleImportError, setGoogleImportError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [deviceContactSupported, setDeviceContactSupported] = useState(false);
  const googleAuthUrl = "/api/google/contacts/auth";
  const [loadingLastSeen, setLoadingLastSeen] = useState(true);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setDeviceContactSupported(
        !!navigator.contacts?.select && typeof navigator.contacts.select === "function",
      );
    }
  }, []);

  const loadUnreadCountsForContacts = useMemo(
    () => async (list: ContactWithLinks[]): Promise<Record<string, number>> => {
      const map: Record<string, number> = {};
      try {
        const res = await fetch("/api/unread-counts", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return map;
        const data = await res.json();
        const convMap: Record<string, number> = data?.conversations || {};
        for (const c of list) {
          const uid = c.registeredUserId;
          if (uid && typeof convMap[uid] === "number") {
            map[uid] = convMap[uid];
          }
        }
      } catch {
        // ignore
      }
      return map;
    },
    [],
  );

  useEffect(() => {
    const registeredIds = Array.from(
      new Set(
        contacts
          .filter((c) => c.registered && c.registeredUserId)
          .map((c) => c.registeredUserId as string),
      ),
    );

    if (registeredIds.length === 0) return;
    void preloadLastSeenForUsers(registeredIds);
  }, [contacts]);

  useEffect(() => {
    setContacts((prev) =>
      prev.map((c) => ({
        ...c,
        online: c.registeredUserId
          ? onlineUserIds.includes(c.registeredUserId)
          : false,
      })),
    );
    setFilteredContacts((prev) =>
      prev.map((c) => ({
        ...c,
        online: c.registeredUserId
          ? onlineUserIds.includes(c.registeredUserId)
          : false,
      })),
    );
  }, [onlineUserIds]);

  useEffect(() => {
    const handleUnread = (payload: any) => {
      const conversations = payload?.conversations || {};
      setContacts((prev) =>
        prev.map((c) => {
          if (!c.registeredUserId) return c;
          const count = Number(conversations[c.registeredUserId] || 0);
          if (count === (c.unread || 0)) return c;
          return { ...c, unread: count };
        }),
      );
      setFilteredContacts((prev) =>
        prev.map((c) => {
          if (!c.registeredUserId) return c;
          const count = Number(conversations[c.registeredUserId] || 0);
          if (count === (c.unread || 0)) return c;
          return { ...c, unread: count };
        }),
      );
    };
    addListener("unread:update", handleUnread);
    return () => removeListener("unread:update", handleUnread);
  }, [addListener, removeListener]);

  const loadShareLinks = async (contactId: string) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, shareLinksLoading: true } : c,
      ),
    );

    const contact = contacts.find((c) => c.id === contactId);
    if (!contact) return;

    const origin =
      typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.host}`
        : "";

    let text = `Welcome to HansariaConnect! Login here: ${origin}/login`;
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobiles: [contact.mobile] }),
      });
      const data = await res.json();
      if (data.smsText) text = data.smsText;
    } catch {}

    const encoded = encodeURIComponent(text);
    const encodedUrl = encodeURIComponent(origin + "/login");

    const shareLinks = {
      wa: `https://wa.me/?text=${encoded}`,
      fb: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encoded}`,
      x: `https://twitter.com/intent/tweet?text=${encoded}&url=${encodedUrl}`,
      sms: `sms:${contact.mobile}?&body=${encoded}`,
    };

    setContacts((prev) =>
      prev.map((c) =>
        c.id === contactId ? { ...c, shareLinks, shareLinksLoading: false } : c,
      ),
    );
  };

  const [showGoogleImportPrompt, setShowGoogleImportPrompt] = useState(false);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (params.get("google_connected") === "1") {
        setShowGoogleImportPrompt(true);
      }
      const googleError = params.get("google_error");
      if (googleError) {
        const messages: Record<string, string> = {
          cancelled: "Google authorization was cancelled.",
          missing_code: "Google did not return an authorization code. Please try again.",
          not_configured: "Google Contacts import is not configured.",
          connection_failed: "Could not connect to Google. Please try again.",
          authorization_failed: "Google authorization failed. Please reconnect your account.",
          state_invalid: "Google authorization expired or could not be verified. Please start again.",
        };
        setGoogleImportError(
          messages[googleError] || "Google Contacts could not be connected.",
        );
      }
      if (params.has("google_connected") || googleError) {
        const url = new URL(window.location.href);
        url.searchParams.delete("google_connected");
        url.searchParams.delete("google_error");
        window.history.replaceState({}, document.title, url.toString());
      }
    } catch {}
  }, []);

  const importGoogleContacts = async () => {
    setSyncing(true);
    setGoogleImportError("");
    try {
      const res = await fetch("/api/google/contacts/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result?.error || "Google contacts could not be imported.");
      }

      const listRes = await fetch("/api/contacts", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await listRes.json();
      if (!listRes.ok || !Array.isArray(data?.contacts)) {
        throw new Error(data?.error || "Imported contacts could not be reloaded.");
      }

      const mapped: ContactWithLinks[] = data.contacts.map((c: any) => ({
        id: c._id,
        name: c.registeredProfile?.name || c.name,
        mobile: c.mobiles?.[0] || "",
        avatar: c.registeredProfile?.photo || c.avatar || "/logo/logo.png",
        pinned: false,
        blocked: false,
        lastMessageTime: c.updatedAt || c.createdAt || "",
        mobiles: c.mobiles || [],
        email: c.email || "",
        registered: !!c.registered,
        registeredUserId: c.registeredUserId || "",
        registeredProfile: c.registeredProfile || null,
        unread: 0,
      }));

      const unreadMap = await loadUnreadCountsForContacts(mapped);
      mapped.forEach((c) => {
        if (c.registeredUserId && unreadMap[c.registeredUserId]) {
          c.unread = unreadMap[c.registeredUserId];
        }
      });

      setContacts(mapped);
      const ids = mapped
        .filter((c) => c.registered && c.registeredUserId)
        .map((c) => c.registeredUserId as string);
      if (ids.length) {
        setLoadingLastSeen(true);
        void preloadLastSeenForUsers(ids).finally(() => setLoadingLastSeen(false));
      } else {
        setLoadingLastSeen(false);
      }

      setInviteMessage(
        `Google contacts imported. ${result.importedCount ?? 0} new contact${result.importedCount === 1 ? "" : "s"} added.`,
      );
      setShowGoogleImportPrompt(false);
    } catch (importError) {
      setGoogleImportError(
        importError instanceof Error
          ? importError.message
          : "Google contacts could not be imported. Please try again.",
      );
    } finally {
      setSyncing(false);
    }
  };

  const importDeviceContacts = async () => {
    if (typeof navigator === "undefined" || !navigator.contacts?.select) {
      setError(
        "Direct mobile contact access is not supported in this browser. Please use Google import or add contacts manually.",
      );
      return;
    }

    setSyncing(true);
    setError("");

    try {
      const selectedContacts = await navigator.contacts.select(["name", "tel"], {
        multiple: true,
      });

      const validEntries = selectedContacts
        .map((person: any) => {
          const numbers = Array.isArray(person?.tel)
            ? person.tel
                .map((entry: any) => String(entry ?? "").replace(/\D/g, ""))
                .filter((value: string) => value.length >= 10)
            : [];

          if (!numbers.length) return null;

          const name =
            Array.isArray(person?.name) && person.name.length > 0
              ? person.name[0]
              : person?.name || "Mobile Contact";

          return { name, mobiles: [...new Set(numbers)] };
        })
        .filter(Boolean) as { name: string; mobiles: string[] }[];

      if (!validEntries.length) {
        setError("No valid mobile numbers were selected from your device contacts.");
        setSyncing(false);
        return;
      }

      const created: any[] = [];
      for (const entry of validEntries) {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name: entry.name.trim(),
            mobiles: entry.mobiles,
          }),
        });

        const data = await res.json();
        if (res.ok && data?.contact) {
          created.push(data.contact);
        }
      }

      if (created.length) {
        const listRes = await fetch("/api/contacts", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await listRes.json();

        if (Array.isArray(data?.contacts)) {
          const mapped = data.contacts.map((c: any) => ({
            id: c._id,
            name: c.registeredProfile?.name || c.name,
            mobile: c.mobiles?.[0] || "",
            avatar: c.registeredProfile?.photo || c.avatar || "/logo/logo.png",
            pinned: false,
            blocked: false,
            lastMessageTime: c.updatedAt || c.createdAt || "",
            mobiles: c.mobiles || [],
            email: c.email || "",
            registered: !!c.registered,
            registeredUserId: c.registeredUserId || "",
            registeredProfile: c.registeredProfile || null,
            unread: 0,
          }));

          const unreadMap = await loadUnreadCountsForContacts(mapped);
          mapped.forEach((c: any) => {
            if (c.registeredUserId && unreadMap[c.registeredUserId]) {
              c.unread = unreadMap[c.registeredUserId];
            }
          });

          setContacts(mapped);
          const ids = mapped
            .filter((c: any) => c.registered && c.registeredUserId)
            .map((c: any) => c.registeredUserId);
          if (ids.length) {
            setLoadingLastSeen(true);
            void preloadLastSeenForUsers(ids).finally(() => setLoadingLastSeen(false));
          } else {
            setLoadingLastSeen(false);
          }
        }
      }
    } catch (err) {
      setError(
        "The device contact picker was blocked or unavailable. Please try again or import contacts another way.",
      );
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    const loadContacts = async () => {
      try {
        const res = await fetch("/api/contacts", {
          cache: "no-store",
          credentials: "include",
        });
        const data = await res.json();

        if (Array.isArray(data?.contacts)) {
          const mapped = data.contacts.map((c: any) => ({
            id: c._id,
            name: c.registeredProfile?.name || c.name,
            mobile: c.mobiles?.[0] || "",
            avatar: c.registeredProfile?.photo || c.avatar || "/logo/logo.png",
            pinned: false,
            blocked: false,
            lastMessageTime: c.updatedAt || c.createdAt || "",
            mobiles: c.mobiles || [],
            email: c.email || "",
            registered: !!c.registered,
            registeredUserId: c.registeredUserId || "",
            registeredProfile: c.registeredProfile || null,
            unread: 0,
          }));

          const unreadMap = await loadUnreadCountsForContacts(mapped);
          mapped.forEach((c: any) => {
            if (c.registeredUserId && unreadMap[c.registeredUserId]) {
              c.unread = unreadMap[c.registeredUserId];
            }
          });

          setContacts(mapped);

          const ids = mapped
            .filter((c: any) => c.registered && c.registeredUserId)
            .map((c: any) => c.registeredUserId);
          if (ids.length) {
            setLoadingLastSeen(true);
            void preloadLastSeenForUsers(ids).finally(() => setLoadingLastSeen(false));
          } else {
            setLoadingLastSeen(false);
          }
        }
      } catch {
        setLoadingLastSeen(false);
      }
    };
    loadContacts();
  }, [loadUnreadCountsForContacts]);

  useEffect(() => {
    let filtered = contacts;

    if (searchQuery.trim()) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.mobile.includes(searchQuery),
      );
    }

    filtered = [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if ((a.unread || 0) !== (b.unread || 0)) {
        return (b.unread || 0) - (a.unread || 0);
      }
      const aName = (a.name || "").trim().toLowerCase();
      const bName = (b.name || "").trim().toLowerCase();
      if (aName && bName && aName !== bName) return aName.localeCompare(bName);
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      const aMobile = a.mobile || "";
      const bMobile = b.mobile || "";
      return aMobile.localeCompare(bMobile);
    });

    setFilteredContacts(filtered);
  }, [contacts, searchQuery]);

  const submitCreate = async () => {
    setError("");
    const cleanMobiles = newMobiles
      .map((m) => m.replace(/\D/g, ""))
      .filter(Boolean);

    if (!newName.trim()) return setError("Name is required");
    if (!cleanMobiles.length)
      return setError("At least one mobile number required");

    setCreating(true);

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.trim(),
          mobiles: cleanMobiles,
          email: newEmail.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.contact) {
        setContacts((prev) => [
          {
            id: data.contact._id,
            name: data.contact.name,
            mobile: data.contact.mobiles?.[0] || "",
            avatar: "/logo/logo.png",
            registered: false,
            mobiles: data.contact.mobiles,
            email: data.contact.email,
            unread: 0,
          },
          ...prev,
        ]);

        setShowCreateModal(false);
        setNewName("");
        setNewMobiles([""]);
        setNewEmail("");
      } else {
        setError(data?.error || "Failed to create contact");
      }
    } catch {
      setError("Failed to create contact");
    }

    setCreating(false);
  };

  const registeredContacts = useMemo(
    () => filteredContacts.filter((c) => c.registered && c.registeredUserId),
    [filteredContacts],
  );
  const invitationContacts = useMemo(
    () => filteredContacts.filter((c) => !c.registered || !c.registeredUserId),
    [filteredContacts],
  );

  const renderContactCard = (c: ContactWithLinks) => {
    const isOnline = Boolean(c.online);
    const lastSeen = c.lastSeenTime ? new Date(c.lastSeenTime) : null;
    const lastSeenLabel = formatLastSeenText(isOnline, lastSeen);
    const unreadCount = Number(c.unread || 0);

    return (
      <motion.div key={c.id} {...fadeIn}>
        <div className="h-full rounded-3xl border border-slate-200/80 bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-lg sm:p-5">
          <div className="flex items-start gap-3 sm:items-center sm:gap-4">
            <div className="relative shrink-0">
              <Image
                src={c.avatar || "/logo/logo.png"}
                alt={c.name}
                width={64}
                height={64}
                className="h-14 w-14 rounded-2xl object-cover ring-1 ring-slate-100 sm:h-16 sm:w-16 sm:rounded-3xl"
              />
              {c.registered && isOnline && (
                <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full" title="Online" />
              )}
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white shadow-md border-2 border-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">
                    {c.name}
                  </p>
                  <p className="truncate text-sm text-slate-500">
                    {c.email || c.mobile}
                  </p>
                </div>
                {c.registered ? (
                  <div className="flex min-w-0 flex-col items-start gap-1 sm:items-end">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1.5 ${
                        isOnline
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                      title={lastSeenLabel}
                    >
                      {isOnline ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Online
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-gray-400" />
                          Offline
                        </>
                      )}
                    </span>
                    <span
                      className="text-[11px] text-gray-500 font-medium"
                      title={lastSeenLabel}
                    >
                      {loadingLastSeen && !lastSeen ? "Loading last seen…" : lastSeenLabel}
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                {c.registered ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        router.push(`/chat/${c.registeredUserId}`)
                      }
                      aria-label={`Send message to ${c.name}`}
                      title="Send message"
                      style={{ backgroundColor: theme.primary }}
                      className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20"
                    >
                      <MessageSquare className="h-4 w-4" />
                      {unreadCount > 0 && (
                        <span
                          aria-label={`${unreadCount} unread`}
                          className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white"
                        >
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageContact(c)}
                      aria-label={`Manage ${c.name}`}
                      title="Edit contact"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!c.shareLinks && !c.shareLinksLoading)
                          loadShareLinks(c.id);
                        setInviteMessage(
                          "Invitation ready. Share the contact link below.",
                        );
                      }}
                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-2 py-2 text-xs font-semibold text-white transition hover:bg-black focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/20 sm:text-sm"
                      disabled={c.shareLinksLoading}
                    >
                      {c.shareLinksLoading
                        ? "Preparing invite..."
                        : "Invite to Hansaria"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManageContact(c)}
                      aria-label={`Manage ${c.name}`}
                      title="Edit contact"
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/10"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>

              {c.shareLinks && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-xs uppercase tracking-[0.15em] text-gray-400">
                    Share via
                  </span>
                  <Link
                    href={c.shareLinks.wa}
                    target="_blank"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-green-500 text-white"
                  >
                    <FaWhatsapp />
                  </Link>
                  <Link
                    href={c.shareLinks.fb}
                    target="_blank"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white"
                  >
                    <FaFacebookF />
                  </Link>
                  <Link
                    href={c.shareLinks.x}
                    target="_blank"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-black text-white"
                  >
                    <FaTwitter />
                  </Link>
                  <Link
                    href={c.shareLinks.sms}
                    className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-slate-500 text-white"
                  >
                    <FaSms />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Suspense fallback={<Loading />}>
      <div className={`min-h-screen ${theme.wallpaper || "bg-slate-50"}`}>
        <Navbar user={user} />

        {(showGoogleImportPrompt || googleImportError) && (
          <aside
            aria-labelledby="google-import-title"
            className="mx-auto mt-4 flex w-full max-w-7xl flex-col gap-4 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                <FaGoogle className="h-5 w-5 text-[#4285F4]" />
              </div>
              <div>
                <h2 id="google-import-title" className="font-bold text-slate-900">
                    {googleImportError
                      ? "Google connection failed"
                      : "Import Google contacts?"}
                  </h2>
                  <p
                    role={googleImportError ? "alert" : undefined}
                    className={`mt-1 text-sm leading-5 ${
                      googleImportError ? "text-red-700" : "text-slate-600"
                    }`}
                  >
                    {googleImportError ||
                      "A Google account is connected. Import its contacts into your HansariaConnect address book?"}
                  </p>
                </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setGoogleImportError("");
                    setShowGoogleImportPrompt(false);
                  }}
                  className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {googleImportError ? "Dismiss" : "Not now"}
                </button>
                {showGoogleImportPrompt && (
                  <button
                    type="button"
                    onClick={importGoogleContacts}
                    disabled={syncing}
                    className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
                    style={{ backgroundColor: theme.primary || "#059669" }}
                  >
                    {syncing ? "Importing..." : "Import"}
                  </button>
                )}
            </div>
          </aside>
        )}

        <main className="mx-auto w-full max-w-7xl px-3 py-5 pb-10 sm:px-5 sm:py-8 lg:px-8">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <section className="mb-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-white via-white to-emerald-50/80 p-4 shadow-sm sm:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                      Your people
                    </p>
                    <h1 className={`mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl ${theme.textSize || ""}`}>
                      Contacts
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                      {contacts.length} saved contact{contacts.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 sm:px-4"
                    style={{ backgroundColor: theme.primary || "#059669" }}
                  >
                    <UserRoundPlus className="h-4 w-4" />
                    <span className="hidden min-[380px]:inline">New contact</span>
                    <span className="min-[380px]:hidden">Add</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={importDeviceContacts}
                  disabled={syncing || !deviceContactSupported}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CircleUserRound className="w-4 h-4" />
                  {deviceContactSupported ? "Use mobile contacts" : "Mobile contacts not supported"}
                </button>
                <button
                  type="button"
                  onClick={() => (window.location.href = googleAuthUrl)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <FaGoogle className="w-4 h-4" />
                  {syncing ? "Importing..." : "Import from Google"}
                  {syncing && (
                    <span className="ml-2 text-xs text-slate-500">
                      Syncing...
                    </span>
                  )}
                </button>
                </div>
              </div>
            </section>
            <div className="rounded-2xl border border-slate-200 bg-white px-3 shadow-sm sm:px-4">
              <SearchBar onSearch={setSearchQuery} placeholder="Search by name or mobile..." />
            </div>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mt-6 space-y-8"
          >
            {inviteMessage && (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                {inviteMessage}
              </div>
            )}

            {registeredContacts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div
                    className="h-8 w-1.5 rounded-full"
                    style={{ backgroundColor: theme.primary }}
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-700">
                      Registered Contacts
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {registeredContacts.length} user{registeredContacts.length !== 1 ? "s" : ""} ·{" "}
                      <span className="font-semibold text-red-500">
                        {registeredContacts.reduce((sum, c) => sum + (c.unread || 0), 0)} unread
                      </span>{" "}
                      messages total
                    </p>
                  </div>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${theme.primary}15`,
                      color: theme.primary,
                    }}
                  >
                    Active Chats
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {registeredContacts.map(renderContactCard)}
                </div>
              </div>
            )}

            {invitationContacts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-1">
                  <div className="h-8 w-1.5 rounded-full bg-slate-300" />
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-slate-500">
                      Invitations Pending
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {invitationContacts.length} contact{invitationContacts.length !== 1 ? "s" : ""} · Not yet on HansariaConnect
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
                    Invite to join
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {invitationContacts.map(renderContactCard)}
                </div>
              </div>
            )}

            {filteredContacts.length === 0 && (
              <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
                <p className="text-lg font-semibold text-gray-900">
                  No contacts found yet
                </p>
                <p className="mt-2 text-sm">
                  Add your first contact or import from Google to start
                  chatting.
                </p>
              </div>
            )}
          </motion.div>
          {showCreateModal && (
            <div
              className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !creating) {
                  setShowCreateModal(false);
                }
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-contact-title"
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-w-xl sm:rounded-[2rem]"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7 sm:py-5">
                  <div>
                    <h2 id="create-contact-title" className="text-lg font-bold text-slate-900">
                      New contact
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Save someone to your contacts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creating}
                    aria-label="Close create contact"
                    className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
                  <div>
                    <label htmlFor="new-contact-name" className="text-sm font-semibold text-slate-700">
                      Name
                    </label>
                    <input
                      id="new-contact-name"
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      maxLength={100}
                      autoComplete="name"
                      placeholder="Enter their name"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-semibold text-slate-700">
                      Mobile Numbers
                    </label>

                    <div className="mt-2 space-y-2">
                      {newMobiles.map((m, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="tel"
                            inputMode="tel"
                            aria-label={`Mobile number ${index + 1}`}
                            value={m}
                            onChange={(e) =>
                              setNewMobiles((prev) =>
                                prev.map((x, i) =>
                                  i === index ? e.target.value : x,
                                ),
                              )
                            }
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                            placeholder="10-digit number"
                          />
                          {newMobiles.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setNewMobiles((prev) =>
                                  prev.filter((_, i) => i !== index),
                                )
                              }
                              aria-label={`Remove mobile number ${index + 1}`}
                              className="flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">Remove</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setNewMobiles([...newMobiles, ""])}
                      className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                    >
                      <Plus className="h-4 w-4" />
                      Add another number
                    </button>
                  </div>

                  <div>
                    <label htmlFor="new-contact-email" className="text-sm font-semibold text-slate-700">
                      Email
                    </label>
                    <input
                      id="new-contact-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      autoComplete="email"
                      className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
                      placeholder="example@mail.com"
                    />
                  </div>

                  {error && (
                    <p role="alert" className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      disabled={creating}
                      className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-11"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={submitCreate}
                      disabled={creating}
                      className="min-h-12 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11"
                      style={{ backgroundColor: theme.primary || "#059669" }}
                    >
                      {creating ? "Saving..." : "Save contact"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
          {manageContact && (
            <ManageContactModal
              contact={{
                id: manageContact.id,
                name: manageContact.name,
                mobile: manageContact.mobiles?.join(", ") || manageContact.mobile,
                email: manageContact.email,
              }}
              onClose={() => setManageContact(null)}
              onSave={async (name) => {
                const res = await fetch("/api/contacts", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ id: manageContact.id, name }),
                });
                const data = await res.json();
                if (!res.ok || !data?.contact) {
                  throw new Error(data?.error || "We couldn't save this contact.");
                }

                setContacts((prev) =>
                  prev.map((ct) =>
                    ct.id === manageContact.id ? { ...ct, name } : ct,
                  ),
                );
                setFilteredContacts((prev) =>
                  prev.map((ct) =>
                    ct.id === manageContact.id ? { ...ct, name } : ct,
                  ),
                );
              }}
              onDelete={async () => {
                const res = await fetch("/api/contacts", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ id: manageContact.id }),
                });
                const data = await res.json();
                if (!res.ok || !data?.deleted) {
                  throw new Error(data?.error || "We couldn't delete this contact.");
                }

                setContacts((prev) =>
                  prev.filter((ct) => ct.id !== manageContact.id),
                );
                setFilteredContacts((prev) =>
                  prev.filter((ct) => ct.id !== manageContact.id),
                );
              }}
              theme={theme}
            />
          )}
        </main>
      </div>
    </Suspense>
  );
}
