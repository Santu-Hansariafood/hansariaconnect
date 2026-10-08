"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Suspense,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { useChatSocket } from "@/hooks/chatwindow/useChatSocket";
import { useSocket } from "@/hooks/useSocket";
import { useLastSeen } from "@/hooks/useLastSeen";
import { useUnreadBehavior } from "@/hooks/chatwindow/useUnreadBehavior";
import { useInfiniteScroll } from "@/hooks/chatwindow/useInfiniteScroll";
import { useApp } from "@/context/AppContext/AppContext";
import Loading from "@/components/common/Loading/Loading";
import dynamic from "next/dynamic";

const SearchBar = dynamic(
  () => import("@/components/common/SearchBar/SearchBar"),
);
const ChatWindowHeader = dynamic(
  () => import("@/components/pages/ChatWindow/ChatWindowHeader"),
);
const ChatWindowFooter = dynamic(
  () => import("@/components/pages/ChatWindow/ChatWindowFooter"),
);
const ChatWindowMessageList = dynamic(
  () => import("@/components/pages/ChatWindow/ChatWindowMessageList"),
);
const ChatWindowModals = dynamic(
  () => import("@/components/pages/ChatWindow/ChatWindowModals"),
);
import {
  ChatMessage,
  ContactInfo,
  ForwardContact,
  GroupMember,
  Theme,
  User,
} from "@/components/pages/ChatWindow/ChatWindowTypes";
import { detectHarmfulFileName } from "@/utils/text/formatting";
import { autoCorrectSpelling } from "@/utils/text/autoCorrect";
import type { TemplateActionButton } from "@/lib/templateActionButtons";
import type { TemplateActionType } from "@/lib/templateActionButtons";

interface ChatWindowProps {
  user: User;
  theme: Theme;
  onBack?: () => void;
  id?: string;
}

type OutboundMessagePayload = {
  type: ChatMessage["type"];
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number;
  linkTitle?: string;
  linkDescription?: string;
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  user,
  theme,
  onBack,
  id: propId,
}) => {
  const router = useRouter();
  const params = useParams();
  const chatId = propId ?? (params?.id as string) ?? "";
  const { getCachedMessages, setCachedMessages, mergeCachedMessages, clearCachedMessages } = useApp();
  const cachedMessagesAtOpen = chatId
    ? getCachedMessages(chatId)?.messages
    : undefined;

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const containerScrollRef = useRef<{
    isAtBottom: boolean;
  }>({ isAtBottom: true });

  const [message, setMessage] = useState("");
  const [focusInputRequest, setFocusInputRequest] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(
    cachedMessagesAtOpen || [],
  );
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [initialLoading, setInitialLoading] = useState(
    !cachedMessagesAtOpen?.length,
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [chatError, setChatError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState("");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<ChatMessage | null>(
    null,
  );
  const [contacts, setContacts] = useState<ForwardContact[]>([]);
  const [isGroup, setIsGroup] = useState(false);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [allowedTemplateActions, setAllowedTemplateActions] = useState<
    TemplateActionType[]
  >([]);
  const [templateActionPreferencesError, setTemplateActionPreferencesError] =
    useState("");

  useEffect(() => {
    let mounted = true;
    const loadActionPreferences = async () => {
      try {
        const response = await fetch("/api/settings", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Could not load message button preferences");
        }
        if (mounted && Array.isArray(data?.allowedTemplateActions)) {
          setAllowedTemplateActions(data.allowedTemplateActions);
          setTemplateActionPreferencesError("");
        } else if (mounted) {
          throw new Error("Message button preferences were not returned");
        }
      } catch (error) {
        console.error("[ChatWindow] Failed to load message button preferences:", error);
        if (mounted) {
          setAllowedTemplateActions([]);
          setTemplateActionPreferencesError(
            error instanceof Error
              ? error.message
              : "Could not load message button preferences",
          );
        }
      }
    };
    void loadActionPreferences();
    return () => {
      mounted = false;
    };
  }, []);

  const headerName =
    (contact?.registeredProfile?.isCompanyVerified &&
      contact.registeredProfile.companyName) ||
    contact?.registeredProfile?.name ||
    contact?.name ||
    "User";
  const headerAvatar =
    contact?.registeredProfile?.photo || contact?.avatar || "/logo/logo.png";
  const isSavedContact = Boolean(contact?.id || contact?._id);

  const mergeUnique = useCallback(
    (prev: ChatMessage[], incoming: ChatMessage[]) => {
      const map = new Map<string, ChatMessage>();
      let hasUpdates = false;

      const addMessage = (msg: ChatMessage) => {
        const key =
          msg._id?.toString?.() ||
          msg.id?.toString?.() ||
          String(msg.createdAt || msg.timestamp || "");
        if (key && !map.has(key)) map.set(key, msg);
      };

      prev.forEach(addMessage);
      incoming.forEach((msg) => {
        const key =
          msg._id?.toString?.() ||
          msg.id?.toString?.() ||
          String(msg.createdAt || msg.timestamp || "");
        if (!key) return;

        const existing = map.get(key);
        if (!existing) {
          map.set(key, msg);
          return;
        }

        const hasChangedFields = (
          Object.keys(msg) as Array<keyof ChatMessage>
        ).some((field) => existing[field] !== msg[field]);
        if (hasChangedFields) {
          map.set(key, { ...existing, ...msg });
          hasUpdates = true;
        }
      });
      if (map.size === prev.length && !hasUpdates) return prev;
      return Array.from(map.values()).sort((a: any, b: any) => {
        const ta = new Date(a?.createdAt || a?.timestamp || 0).getTime();
        const tb = new Date(b?.createdAt || b?.timestamp || 0).getTime();
        return ta - tb;
      });
    },
    [],
  );

  const extractId = (value?: string | { toString?: () => string }) => {
    if (!value) return "";
    return typeof value === "string" ? value : value.toString?.() || "";
  };

  const getMessageId = (msg?: ChatMessage) =>
    extractId(msg?._id) || extractId(msg?.id);

  const { socket, typingUserIds, sendTyping } = useChatSocket(
    chatId,
    setChatMessages,
    mergeUnique,
    undefined,
    isGroup,
  );

  const typingUsers = useMemo(() => {
    if (!typingUserIds.length) return [];
    if (!isGroup) return [headerName];
    const names: string[] = [];
    typingUserIds.forEach((uid) => {
      const member = groupMembers.find(
        (m) => String(m.id) === String(uid),
      );
      if (member?.name) names.push(member.name);
    });
    return names;
  }, [typingUserIds, isGroup, headerName, groupMembers]);

  const { containerRef, hasMore, setHasMore, handleScroll } = useInfiniteScroll(
    chatId,
    chatMessages,
    setChatMessages,
    mergeUnique,
    isGroup,
  );

  const {
    unreadOnOpen,
    showUnreadBanner,
    unreadDividerRef,
    hasScrolledToUnreadRef,
  } = useUnreadBehavior(
    chatId,
    chatMessages,
    socket,
    setChatMessages,
    isGroup,
    user.id,
  );

  const AUTO_SCROLL_THRESHOLD_PX = 80;
  const checkIsAtBottom = useCallback((): boolean => {
    const el = containerRef?.current ?? null;
    if (!el) return true;
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
  }, [containerRef]);

  const syncIsAtBottom = useCallback(() => {
    containerScrollRef.current.isAtBottom = checkIsAtBottom();
  }, [checkIsAtBottom]);

  const scrollToBottom = useCallback((smooth: boolean = false) => {
    if (!messagesEndRef.current) return;
    messagesEndRef.current.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "end",
    });
    containerScrollRef.current.isAtBottom = true;
  }, []);

  useEffect(() => {
    const el = containerRef?.current;
    if (!el) return;
    const listener = () => {
      syncIsAtBottom();
    };
    el.addEventListener("scroll", listener, { passive: true });
    syncIsAtBottom();
    return () => el.removeEventListener("scroll", listener);
  }, [containerRef, syncIsAtBottom]);

  useEffect(() => {
    if (chatMessages.length === 0) return;

    const fromMe = chatMessages.length > 0
      ? String(chatMessages[chatMessages.length - 1]?.from) === String(user.id)
      : false;
    const isAtBottom = containerScrollRef.current.isAtBottom;
    const el = containerRef?.current ?? null;

    if (fromMe) {
      const snap = () => scrollToBottom(true);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(snap));
      } else {
        snap();
      }
      return;
    }

    if (isAtBottom) {
      const snap = () => scrollToBottom(false);
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => window.requestAnimationFrame(snap));
      } else {
        snap();
      }
    } else if (el) {
      const prevHeight = el.scrollHeight;
      const tick = () => {
        const newHeight = el.scrollHeight;
        const delta = newHeight - prevHeight;
        if (delta > 0) el.scrollTop += delta;
      };
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(tick);
      } else {
        tick();
      }
    }
  }, [chatMessages, containerRef, scrollToBottom, user.id]);

  useEffect(() => {
    if (!chatId) return;

    const cached = getCachedMessages(chatId);
    const hasCachedMessages = Boolean(cached?.messages.length);
    setInitialLoading(!hasCachedMessages);
    setChatError("");
    setChatMessages(cached?.messages || []);
    setContact(null);
    setIsGroup(false);
    setGroupMembers([]);
    setMessage("");
    setSearchQuery("");
    setSearchResults([]);
    setShowOptionsMenu(false);
    setShowSearch(false);

    const loadInitialData = async () => {
      try {
        if (cached && cached.messages.length > 0) {
          setHasMore(!!cached.hasMore);
        }

        const accessCheckRes = await fetch(
          `/api/chat-access?chatId=${encodeURIComponent(chatId)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!accessCheckRes.ok) {
          setChatError(
            accessCheckRes.status === 401
              ? "Your session expired. Please sign in again."
              : "This chat is not available for your account.",
          );
          return;
        }

        const accessData = await accessCheckRes.json();
        if (!accessData?.access) {
          setChatError("You do not have access to this chat.");
          return;
        }

        let isGroupChat = accessData?.type === "group";

        if (isGroupChat) {
          try {
            const groupRes = await fetch(`/api/groups/${chatId}`, {
              credentials: "include",
              cache: "no-store",
            });
            if (groupRes.ok) {
              const groupData = await groupRes.json();
              if (groupData?.group) {
                setIsGroup(true);
                setGroupMembers(groupData.group.members || []);
                setContact({
                  name: groupData.group.name || "Group",
                  avatar: groupData.group.avatar || "/logo/logo.png",
                  registeredUserId: chatId,
                });
              }
            }
          } catch (err: any) {
            console.error(
              "[ChatWindow] Group info fetch error:",
              err?.message || err,
            );
          }
        }

        const messagesEndpoint = isGroupChat
          ? `/api/groups/${chatId}/messages?limit=30&last=true`
          : `/api/messages/${chatId}?limit=30&last=true`;

        const shouldFetchMessages = !cached || cached.messages.length === 0;

        const contactsPromise = fetch("/api/contacts", { credentials: "include", cache: "no-store" });
        const messagesPromise = shouldFetchMessages
          ? fetch(messagesEndpoint, { credentials: "include", cache: "no-store" })
          : Promise.resolve(null);
        const accessPromise = fetch("/api/access/me", { cache: "no-store" });

        const [contactsRes, messagesRes, accessRes] = await Promise.all([
          contactsPromise,
          messagesPromise,
          accessPromise,
        ]);

        if (contactsRes.ok) {
          const contactsData = await contactsRes.json();
          type RawContact = {
            registeredUserId?: string;
            _id?: string;
            id?: string;
            name?: string;
            mobile?: string;
            avatar?: string;
            registeredProfile?: {
              name?: string;
              photo?: string;
              companyName?: string;
              companyDomain?: string;
              isCompanyVerified?: boolean;
            };
          };

          if (Array.isArray(contactsData?.contacts)) {
            const loadedContacts = contactsData.contacts
              .filter((c: RawContact) =>
                Boolean(c.registeredUserId || c._id || c.id),
              )
              .map((c: RawContact) => ({
                id: String(c.registeredUserId || c._id || c.id),
                name:
                  c.name || c.registeredProfile?.name || c.mobile || "Unknown",
                mobile: c.mobile || "",
                avatar:
                  c.registeredProfile?.photo || c.avatar || "/logo/logo.png",
              })) as ForwardContact[];

            setContacts(loadedContacts);

            if (!isGroupChat) {
              const found = contactsData.contacts.find(
                (c: RawContact) =>
                  String(c.registeredUserId) === chatId ||
                  String(c._id) === chatId ||
                  String(c.id) === chatId,
              );
              if (found) {
                const normalized = {
                  id: String(
                    found.registeredUserId || found._id || found.id || "",
                  ),
                  name:
                    found.registeredProfile?.name ||
                    found.name ||
                    (Array.isArray(found.mobiles)
                      ? found.mobiles[0]
                      : found.mobile || undefined) ||
                    "Unknown",
                  mobile: Array.isArray(found.mobiles)
                    ? found.mobiles[0] || ""
                    : found.mobile || "",
                  avatar:
                    found.registeredProfile?.photo ||
                    found.avatar ||
                    "/logo/logo.png",
                  registered: !!found.registered,
                  registeredUserId: found.registeredUserId || "",
                  registeredProfile: found.registeredProfile || null,
                  _raw: found,
                } as any;

                setContact(normalized as any);
              } else {
                try {
                  const userRes = await fetch(`/api/users/${chatId}`, {
                    credentials: "include",
                  });
                  if (userRes.ok) {
                    const userData = await userRes.json();
                    const u =
                      userData?.user || userData?.data || userData || {};
                    setContact({
                      name: u?.name || u?.fullName || u?.mobile || "Unknown",
                      avatar:
                        u?.avatar ||
                        u?.photo ||
                        u?.profilePhoto ||
                        "/logo/logo.png",
                      mobile: u?.mobile || u?.phone || "",
                      registered: true,
                      registeredUserId: u?.id || u?._id || chatId,
                      registeredProfile: {
                        name: u?.name || u?.fullName || u?.mobile || "Unknown",
                        photo: u?.avatar || u?.photo || u?.profilePhoto || "",
                        companyName: u?.companyName || "",
                        companyDomain: u?.companyDomain || "",
                        isCompanyVerified: Boolean(u?.isCompanyVerified),
                      },
                    } as any);
                  }
                } catch (err: any) {
                  console.warn(
                    "[ChatWindow] Fallback user info fetch error:",
                    err?.message || err,
                  );
                }
              }
            }
          }
        } else if (!contactsRes.ok && contactsRes.status >= 500) {
          setChatError("Contacts could not be loaded. Check your connection and retry.");
        }

        if (messagesRes !== null && messagesRes.ok) {
          const messagesData = await messagesRes.json();
          let finalMessages: any[] = [];
          if (Array.isArray(messagesData?.messages)) {
            finalMessages = messagesData.messages;
            setChatMessages((prev) => mergeUnique(prev, finalMessages));
          }
          setHasMore(!!messagesData?.hasMore);
          if (chatId) {
            setCachedMessages(chatId, {
              messages: finalMessages.length > 0 ? finalMessages : [],
              hasMore: !!messagesData?.hasMore,
              loadedAt: Date.now(),
            });
          }
        } else if (messagesRes !== null && !messagesRes.ok) {
          setChatError(
            messagesRes.status === 401
              ? "Your session expired. Please sign in again."
              : "Messages could not be loaded. Check your connection and retry.",
          );
        }

        if (accessRes.ok) {
          const accessData = await accessRes.json();
          setAllowAttachments(
            accessData && typeof accessData === "object"
              ? Boolean(accessData?.permissions?.attachments)
              : true,
          );
        } else {
          setAllowAttachments(true);
        }

        try {
          const receiptBody = isGroupChat
            ? { groupId: chatId }
            : { peerId: chatId };
          await fetch("/api/read-receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(receiptBody),
          });
        } catch (err: any) {
          console.warn(
            "[ChatWindow] Marking read-receipts on open failed:",
            err?.message || err,
          );
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();

    return () => {
      setInitialLoading(false);
    };
  }, [chatId, getCachedMessages, loadAttempt, mergeUnique, router]);

  useEffect(() => {
    if (!chatId) return;
    if (initialLoading) return;
    if (chatMessages.length === 0) return;
    mergeCachedMessages(chatId, chatMessages, hasMore);
  }, [chatId, chatMessages, hasMore, initialLoading, mergeCachedMessages]);

  const { onlineUserIds } = useSocket();
  const isContactOnline = !isGroup && onlineUserIds.includes(chatId);

  const maskedUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/chat/${String(chatId).slice(-4)}`;
  }, [chatId]);

  const handleOpenSaveModal = () => {
    setSaveError("");
    setSaveName(headerName);
    setShowSaveModal(true);
    setShowOptionsMenu(false);
  };

  const handleSaveContact = async () => {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setSaveError("Name is required");
      return;
    }

    const mobile = String(contact?.mobile || "");
    const cleaned = mobile.replace(/\D/g, "");
    if (!/^\d{10}$/.test(cleaned)) {
      setSaveError("Valid 10-digit mobile required");
      return;
    }

    setSavingContact(true);
    setSaveError("");

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmedName, mobiles: [cleaned] }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error || "Failed to save contact");
      } else if (data?.contact) {
        setContact(data.contact);
        setShowSaveModal(false);
      }
    } catch (err: any) {
      console.error("[ChatWindow] Save contact error:", err?.message || err);
      setSaveError("Failed to save contact");
    } finally {
      setSavingContact(false);
    }
  };

  const handleOpenEditModal = () => {
    setEditError("");
    setEditName(headerName);
    setShowEditModal(true);
    setShowOptionsMenu(false);
  };

  const handleEditContact = async () => {
    if (!isSavedContact) return;
    if (!editName.trim()) {
      setEditError("Name is required");
      return;
    }

    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: contact?._id || contact?.id,
          name: editName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data?.error || "Failed to update contact");
      } else if (data?.contact) {
        setContact(data.contact);
        setShowEditModal(false);
      }
    } catch (err: any) {
      console.error("[ChatWindow] Update contact error:", err?.message || err);
      setEditError("Failed to update contact");
    }
  };

  const generateTempId = () =>
    `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const sendViaRest = async (
    payload: OutboundMessagePayload,
    tempMessage?: ChatMessage,
  ) => {
    try {
      const endpoint = isGroup
        ? `/api/groups/${chatId}/messages`
        : `/api/messages/${chatId}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data?.message) {
        const tempId = tempMessage ? getMessageId(tempMessage) : "";
        if (tempId) {
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg._id?.toString?.() === tempId ? data.message : msg,
            ),
          );
        } else {
          setChatMessages((prev) => mergeUnique(prev, [data.message]));
        }
        return true;
      }
      console.warn(
        "[ChatWindow] sendViaRest HTTP",
        res.status,
        "- server response:",
        data,
      );
    } catch (err: any) {
      console.error("[ChatWindow] sendViaRest network error:", err?.message || err);
    }

    const failedId = getMessageId(tempMessage);
    if (failedId) {
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg._id?.toString?.() === failedId
            ? { ...msg, status: "failed" }
            : msg,
        ),
      );
    }

    return false;
  };

  const sendViaSocket = async (
    payload: OutboundMessagePayload,
    tempMessage?: ChatMessage,
  ) => {
    if (!socket) {
      console.warn("[ChatWindow] sendViaSocket skipped — socket not initialized yet");
      return false;
    }
    if (!socket.connected) {
      console.warn(
        "[ChatWindow] sendViaSocket skipped — socket not connected (state:",
        socket.disconnected ? "disconnected" : "connecting",
        "). Will attempt REST fallback.",
      );
      return false;
    }

    return new Promise<boolean>((resolve) => {
      const eventName = isGroup ? "group:message:send" : "message:send";
      const socketPayload = isGroup
        ? { groupId: chatId, ...payload }
        : { to: chatId, ...payload };

      let resolved = false;
      const fail = () => {
        if (resolved) return;
        resolved = true;
        const failedId = getMessageId(tempMessage);
        if (failedId) {
          setChatMessages((prev) =>
            prev.map((msg) =>
              msg._id?.toString?.() === failedId
                ? { ...msg, status: "failed" }
                : msg,
            ),
          );
        }
        resolve(false);
      };

      try {
        socket.timeout(12_000).emit(
          eventName,
          socketPayload,
          (
            timeoutError: Error | null,
            ack?: { ok?: boolean; message?: ChatMessage; error?: string },
          ) => {
            if (resolved) return;
            resolved = true;
            if (timeoutError) {
              console.error(
                "[ChatWindow] sendViaSocket timed out (12s) for event",
                eventName,
                ":",
                timeoutError.message,
              );
              const failedId = getMessageId(tempMessage);
              if (failedId) {
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg._id?.toString?.() === failedId
                      ? { ...msg, status: "failed" }
                      : msg,
                  ),
                );
              }
              resolve(false);
              return;
            }

            const ackMessage = ack?.ok && ack?.message ? ack.message : undefined;
            if (ackMessage) {
              const tempId = getMessageId(tempMessage);
              if (tempId) {
                setChatMessages((prev) =>
                  prev.map((msg) =>
                    msg._id?.toString?.() === tempId ? ackMessage : msg,
                  ),
                );
              } else {
                setChatMessages((prev) => mergeUnique(prev, [ackMessage]));
              }
              resolve(true);
              return;
            }

            console.warn(
              "[ChatWindow] sendViaSocket failed — ack not OK:",
              ack?.error || ack,
            );
            fail();
          },
        );
      } catch (err: any) {
        console.error("[ChatWindow] sendViaSocket emit threw:", err?.message || err);
        fail();
      }
    });
  };

  const handleSend = async (messageOverride?: string): Promise<boolean> => {
    const trimmed = (
      await autoCorrectSpelling((messageOverride ?? message).trim())
    ).trim();
    if (!trimmed) return false;

    const tempId = generateTempId();
    const optimisticMessage: ChatMessage = {
      _id: tempId,
      from: String(user.id),
      to: chatId,
      type: "text",
      text: trimmed,
      status: "sending",
      createdAt: new Date(),
    };

    setChatMessages((prev) => mergeUnique(prev, [optimisticMessage]));
    if (messageOverride === undefined) setMessage("");

    const payload: OutboundMessagePayload = { type: "text", text: trimmed };

    const socketOk = await sendViaSocket(payload, optimisticMessage);
    if (socketOk) return true;
    console.warn(
      "[ChatWindow] sendViaSocket failed or no socket — falling back to REST send",
    );
    return sendViaRest(payload, optimisticMessage);
  };

  const handleTemplateButton = async (
    sourceMessage: ChatMessage,
    button: TemplateActionButton,
  ): Promise<boolean> => {
    if (
      isGroup ||
      !chatId ||
      String(sourceMessage.from || "") === String(user.id) ||
      String(sourceMessage.to || "") !== String(user.id)
    ) {
      return false;
    }

    if (button.type === "reply") {
      setMessage(button.replyText || "");
      setFocusInputRequest((current) => current + 1);
      return true;
    }

    if (button.type === "confirm") {
      return handleSend(button.replyText);
    }
    return false;
  };

  const handleReaction = async (msg: ChatMessage, emoji: string) => {
    const messageId = getMessageId(msg);
    if (!messageId) return false;

    try {
      const endpoint = isGroup
        ? `/api/groups/${chatId}/messages`
        : `/api/messages/${chatId}`;
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messageId, emoji }),
      });
      const data = await res.json();
      if (!res.ok || !data?.reactions) {
        console.warn("[ChatWindow] Reaction save failed:", data?.error || `HTTP ${res.status}`);
        return false;
      }

      setChatMessages((prev) =>
        prev.map((item) =>
          getMessageId(item) === messageId
            ? { ...item, reactions: data.reactions }
            : item,
        ),
      );
      return true;
    } catch (err: any) {
      console.error("[ChatWindow] Reaction update error:", err?.message || err);
      return false;
    }
  };

  const handleMediaSelect = async (
    fileOrData: File | { url: string },
    type: ChatMessage["type"],
    duration?: number,
  ) => {
    setShowMediaPicker(false);
    setMediaError("");

    const sendMedia = async (payload: OutboundMessagePayload) => {
      const optimisticMessage: ChatMessage = {
        _id: generateTempId(),
        from: String(user.id),
        to: chatId,
        type: payload.type,
        text: payload.text,
        mediaUrl: payload.mediaUrl,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        duration: payload.duration,
        linkTitle: payload.linkTitle,
        linkDescription: payload.linkDescription,
        status: "sending",
        createdAt: new Date(),
      };

      setChatMessages((prev) => mergeUnique(prev, [optimisticMessage]));
      const socketOk = await sendViaSocket(payload, optimisticMessage);
      if (!socketOk) {
        console.warn(
          "[ChatWindow] Media sendViaSocket failed — falling back to REST",
        );
        await sendViaRest(payload, optimisticMessage);
      }
    };

    const uploadFile = async (file: File, kind: string) => {
      const harmfulFile = detectHarmfulFileName(file.name);
      if (harmfulFile.hasWarning) {
        setMediaError(`File blocked: ${harmfulFile.warnings.join(", ")}`);
        return;
      }

      if (file.size <= 0 || file.size > 50 * 1024 * 1024) {
        setMediaError("File blocked: empty files and files over 50 MB are not allowed.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("kind", kind);
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) {
          setMediaError(data?.error || "File was blocked because it is unsafe or corrupt.");
          return;
        }
        if (data?.url) {
          await sendMedia({
            type,
            mediaUrl: data.url,
            fileName: file.name,
            fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
            duration,
          });
        } else {
          console.warn("[ChatWindow] Upload returned no URL:", data);
          setMediaError("Upload failed: server did not return a file URL.");
        }
      } catch (err: any) {
        console.error("[ChatWindow] File upload error:", err?.message || err);
        setMediaError("File upload failed. The file was not sent.");
      }
    };

    if (type === "link" && "url" in fileOrData) {
      await sendMedia({
        type: "link",
        text: fileOrData.url,
        mediaUrl: fileOrData.url,
      });
      return;
    }

    if (fileOrData instanceof File) {
      const uploadKind = type === "image" || type === "video" ? type : "file";
      await uploadFile(fileOrData, uploadKind);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    if (chatId) clearCachedMessages(chatId);
    setShowClearConfirm(false);
    setShowOptionsMenu(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const normalized = query.toLowerCase();
    setSearchResults(
      chatMessages.filter((msg) =>
        msg.text?.toLowerCase().includes(normalized),
      ),
    );
  };

  const handleBlockToggle = () => {
    setShowOptionsMenu(false);
  };

  const handleForwardMessage = (msg: ChatMessage) => {
    setMessageToForward(msg);
    setShowForwardModal(true);
  };

  const handleForwardSubmit = async (selectedIds: string[], text: string) => {
    if (!messageToForward) {
      setShowForwardModal(false);
      return;
    }

    const payload: OutboundMessagePayload = {
      type: messageToForward.type,
      text: text || messageToForward.text,
      mediaUrl: messageToForward.mediaUrl,
      fileName: messageToForward.fileName,
      fileSize: messageToForward.fileSize,
      duration: messageToForward.duration,
      linkTitle: messageToForward.linkTitle,
      linkDescription: messageToForward.linkDescription,
    };

    await Promise.all(
      selectedIds.map(async (contactId) => {
        if (socket) {
          socket.emit("message:send", { to: contactId, ...payload }, () => {});
        } else {
          await fetch(`/api/messages/${contactId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });
        }
      }),
    );

    setShowForwardModal(false);
    setMessageToForward(null);
  };

  const messagesToRender = useMemo(
    () => (showSearch && searchQuery.trim() ? searchResults : chatMessages),
    [chatMessages, searchQuery, searchResults, showSearch],
  );

  const { statusText: lastSeenStatus } = useLastSeen(
    !isGroup ? chatId : undefined,
  );

  if (initialLoading) {
    return <Loading />;
  }

  if (chatError) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col items-center justify-center bg-[#efeae2] px-5 text-center">
        <p className="max-w-md text-sm text-[#54656f]">{chatError}</p>
        <div className="mt-5 flex w-full max-w-xs gap-3">
          <button
            onClick={() => {
              setInitialLoading(true);
              setLoadAttempt((attempt) => attempt + 1);
            }}
            className="flex-1 rounded-xl bg-[#00a884] px-4 py-3 text-sm font-semibold text-white"
          >
            Retry
          </button>
          <button
            onClick={onBack || (() => router.replace("/chat"))}
            className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#111b21]"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden overscroll-none bg-[#efeae2]">
        {mediaError && (
          <div className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{mediaError}</span>
            <button type="button" onClick={() => setMediaError("")} className="font-semibold">Dismiss</button>
          </div>
        )}
        <ChatWindowHeader
          theme={theme}
          onBack={onBack || (() => router.push("/"))}
          headerName={headerName}
          isCompanyVerified={Boolean(
            contact?.registeredProfile?.isCompanyVerified,
          )}
          companyDomain={contact?.registeredProfile?.companyDomain}
          headerAvatar={headerAvatar}
          isContactOnline={isContactOnline}
          isGroup={isGroup}
          typingUsers={typingUsers}
          onOpenGroup={() => router.push(`/group-settings/${chatId}`)}
          showUnreadBanner={showUnreadBanner}
          unreadOnOpen={unreadOnOpen}
          showOptionsMenu={showOptionsMenu}
          setShowOptionsMenu={setShowOptionsMenu}
          isSavedContact={isSavedContact}
          onSaveContact={handleOpenSaveModal}
          onEditContact={handleOpenEditModal}
          onClearClick={() => setShowClearConfirm(true)}
          onSearch={() => setShowSearch(true)}
          onBlockToggle={handleBlockToggle}
          maskedUrl={maskedUrl}
          lastSeenStatus={lastSeenStatus}
        />

        {showSearch && (
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="max-w-4xl mx-auto">
              <SearchBar
                onSearch={handleSearch}
                placeholder="Search messages..."
              />
            </div>
          </div>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
            className={`flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 pb-2 pt-3 [scrollbar-width:thin] sm:px-6 sm:py-4 md:px-8 ${
            !theme.wallpaperImage ? theme.wallpaper || "bg-[#efeae2]" : ""
          }`}
          style={
            theme.wallpaperImage
              ? {
                  backgroundImage: `url(${theme.wallpaperImage})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <ChatWindowMessageList
            messages={messagesToRender}
            allowedTemplateActions={allowedTemplateActions}
            templateActionPreferencesError={templateActionPreferencesError}
            theme={theme}
            user={user}
            id={chatId}
            isGroup={isGroup}
            headerName={headerName}
            headerAvatar={headerAvatar}
            groupMembers={groupMembers}
            onForwardMessage={handleForwardMessage}
            onReaction={handleReaction}
            onTemplateButton={handleTemplateButton}
            showUnreadBanner={showUnreadBanner}
            unreadOnOpen={unreadOnOpen}
            unreadDividerRef={unreadDividerRef}
            typingUsers={typingUsers}
          />
          <div ref={messagesEndRef} />
        </div>

        <ChatWindowFooter
          theme={theme}
          message={message}
          setMessage={setMessage}
          handleSend={handleSend}
          focusInputRequest={focusInputRequest}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          allowAttachments={allowAttachments}
          showMediaPicker={showMediaPicker}
          setShowMediaPicker={setShowMediaPicker}
          handleMediaSelect={handleMediaSelect}
          showForwardModal={showForwardModal}
          contacts={contacts}
          onCloseForward={() => setShowForwardModal(false)}
          onForwardSubmit={handleForwardSubmit}
          sendTyping={sendTyping}
        />

        <ChatWindowModals
          theme={theme}
          showSaveModal={showSaveModal}
          setShowSaveModal={setShowSaveModal}
          saveName={saveName}
          setSaveName={setSaveName}
          saveError={saveError}
          savingContact={savingContact}
          onSaveContact={handleSaveContact}
          showEditModal={showEditModal}
          setShowEditModal={setShowEditModal}
          editName={editName}
          setEditName={setEditName}
          editError={editError}
          onEditContact={handleEditContact}
          showClearConfirm={showClearConfirm}
          setShowClearConfirm={setShowClearConfirm}
          onClearChat={handleClearChat}
          headerName={headerName}
        />
      </div>
    </Suspense>
  );
};

export default ChatWindow;
