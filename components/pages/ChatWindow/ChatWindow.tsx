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
import { useNotifications } from "@/hooks/useNotifications";
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [contact, setContact] = useState<ContactInfo | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
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

  const headerName =
    contact?.registeredProfile?.name || contact?.name || "User";
  const headerAvatar =
    contact?.registeredProfile?.photo || contact?.avatar || "/logo/logo.png";
  const isSavedContact = Boolean(contact?.id || contact?._id);

  const { preferences, playRingtone, requestPermission } = useNotifications();

  const mergeUnique = useCallback(
    (prev: ChatMessage[], incoming: ChatMessage[]) => {
      const map = new Map<string, ChatMessage>();

      const addMessage = (msg: ChatMessage) => {
        const key =
          msg._id?.toString?.() ||
          msg.id?.toString?.() ||
          String(msg.createdAt || msg.timestamp || "");
        if (key && !map.has(key)) map.set(key, msg);
      };

      prev.forEach(addMessage);
      incoming.forEach(addMessage);
      return Array.from(map.values());
    },
    [],
  );

  const extractId = (value?: string | { toString?: () => string }) => {
    if (!value) return "";
    return typeof value === "string" ? value : value.toString?.() || "";
  };

  const getMessageId = (msg?: ChatMessage) =>
    extractId(msg?._id) || extractId(msg?.id);

  const socket = useChatSocket(
    chatId,
    setChatMessages,
    mergeUnique,
    useCallback(
      (msg: ChatMessage) => {
        const senderId = String(msg?.from || "");
        const selfId = String(user.id || "");
        if (
          senderId !== selfId &&
          preferences.messages &&
          preferences.enabled
        ) {
          playRingtone(preferences.ringtone || "chime");
          if (
            typeof window !== "undefined" &&
            Notification.permission === "granted" &&
            document.hidden
          ) {
            const title = headerName || "New message";
            const body = msg?.text || "You have a new chat message";
            new Notification(title, {
              body,
              icon: "/logo/logo.png",
              tag: `chat-${chatId}`,
            });
          }
        }
      },
      [
        chatId,
        headerName,
        playRingtone,
        preferences.enabled,
        preferences.messages,
        preferences.ringtone,
        user.id,
      ],
    ),
    isGroup,
  );

  const { containerRef, handleScroll } = useInfiniteScroll(
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
  } = useUnreadBehavior(chatId, chatMessages, socket, setChatMessages);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      preferences.enabled &&
      Notification.permission === "default"
    ) {
      requestPermission();
    }
  }, [preferences.enabled, requestPermission]);

  useEffect(() => {
    if (unreadOnOpen > 0 && !hasScrolledToUnreadRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, unreadOnOpen, hasScrolledToUnreadRef]);

  useEffect(() => {
    if (!chatId) return;

    setInitialLoading(true);
    setChatMessages([]);
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
        const accessCheckRes = await fetch(
          `/api/chat-access?chatId=${encodeURIComponent(chatId)}`,
          {
            credentials: "include",
            cache: "no-store",
          },
        );

        if (!accessCheckRes.ok) {
          router.replace("/chats");
          return;
        }

        const accessData = await accessCheckRes.json();
        if (!accessData?.access) {
          router.replace("/chats");
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
          } catch {
            // ignore group fetch errors
          }
        }

        const messagesEndpoint = isGroupChat
          ? `/api/groups/${chatId}/messages?all=true&last=true`
          : `/api/messages/${chatId}?all=true&last=true`;

        const [contactsRes, messagesRes, accessRes] = await Promise.all([
          fetch("/api/contacts", { credentials: "include", cache: "no-store" }),
          fetch(messagesEndpoint, {
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/access/me", { cache: "no-store" }),
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
            registeredProfile?: { name?: string; photo?: string };
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
                    } as any);
                  }
                } catch {
                  // ignore fallback user fetch errors
                }
              }
            }
          }
        }

        if (messagesRes.ok) {
          const messagesData = await messagesRes.json();
          if (Array.isArray(messagesData?.messages)) {
            setChatMessages((prev) => mergeUnique(prev, messagesData.messages));
          }
        }

        if (accessRes.ok) {
          const accessData = await accessRes.json();
          setAllowAttachments(Boolean(accessData?.permissions?.attachments));
        }

        try {
          const receiptBody = isGroup
            ? { groupId: chatId }
            : { peerId: chatId };
          await fetch("/api/read-receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(receiptBody),
          });
        } catch {
          // ignore marking as read failures
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialData();

    return () => {
      setInitialLoading(false);
    };
  }, [chatId, mergeUnique, router]);

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
    } catch {
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
    } catch {
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
    } catch {
      // ignore
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
    if (!socket) return false;

    return new Promise<boolean>((resolve) => {
      const eventName = isGroup ? "group:message:send" : "message:send";
      const socketPayload = isGroup
        ? { groupId: chatId, ...payload }
        : { to: chatId, ...payload };

      socket.emit(
        eventName,
        socketPayload,
        (ack: { ok?: boolean; message?: ChatMessage }) => {
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
        },
      );
    });
  };

  const handleSend = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const optimisticMessage: ChatMessage = {
      _id: generateTempId(),
      from: String(user.id),
      to: chatId,
      type: "text",
      text: trimmed,
      status: "sending",
      createdAt: new Date(),
    };

    setChatMessages((prev) => mergeUnique(prev, [optimisticMessage]));
    setMessage("");

    const sent = await sendViaSocket(
      { type: "text", text: trimmed },
      optimisticMessage,
    );
    if (!sent) {
      await sendViaRest({ type: "text", text: trimmed }, optimisticMessage);
    }
  };

  const handleMediaSelect = async (
    fileOrData: File | { url: string },
    type: ChatMessage["type"],
  ) => {
    setShowMediaPicker(false);

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
      const sent = await sendViaSocket(payload, optimisticMessage);
      if (!sent) {
        await sendViaRest(payload, optimisticMessage);
      }
    };

    const uploadFile = async (file: File, kind: string) => {
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
        if (data?.url) {
          await sendMedia({
            type,
            mediaUrl: data.url,
            fileName: file.name,
            fileSize: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          });
        }
      } catch {
        // ignore upload failure
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

  return (
    <Suspense fallback={<Loading />}>
      <div className="h-full w-full flex flex-col bg-[#efeae2] min-w-0 overflow-hidden">
        <ChatWindowHeader
          theme={theme}
          onBack={onBack || (() => router.push("/"))}
          headerName={headerName}
          headerAvatar={headerAvatar}
          isContactOnline={isContactOnline}
          isGroup={isGroup}
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
          className={`flex-1 overflow-y-auto min-w-0 min-h-0 px-4 sm:px-6 md:px-8 py-3 sm:py-4 ${
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
            theme={theme}
            user={user}
            id={chatId}
            isGroup={isGroup}
            headerName={headerName}
            headerAvatar={headerAvatar}
            groupMembers={groupMembers}
            onForwardMessage={handleForwardMessage}
            showUnreadBanner={showUnreadBanner}
            unreadOnOpen={unreadOnOpen}
            unreadDividerRef={unreadDividerRef}
          />
          <div ref={messagesEndRef} />
        </div>

        <ChatWindowFooter
          theme={theme}
          message={message}
          setMessage={setMessage}
          handleSend={handleSend}
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
