import { useSocket } from "../useSocket";
import { useChatSocketMessages } from "./useChatSocketMessages";
import { useChatSocketTyping } from "./useChatSocketTyping";
import { useChatSocketCatchup } from "./useChatSocketCatchup";
import type {
  ChatMessageMerger,
  ChatMessageSetter,
} from "./chatSocketTypes";
import type { ChatMessage } from "@/components/pages/ChatWindow/ChatWindowTypes";

export const useChatSocket = (
  id: string,
  setChatMessages: ChatMessageSetter,
  mergeUnique: ChatMessageMerger,
  onIncomingMessage?: (msg: ChatMessage) => void,
  isGroup: boolean = false,
  skipInitialCatchup: boolean = false,
) => {
  const { socket, addListener, removeListener } = useSocket({
    subscribeOnline: false,
  });

  const { typingUserIds, sendTyping } = useChatSocketTyping({
    id,
    isGroup,
    socket,
    addListener,
    removeListener,
  });

  useChatSocketMessages({
    id,
    isGroup,
    socket,
    addListener,
    removeListener,
    setChatMessages,
    mergeUnique,
    onIncomingMessage,
  });

  useChatSocketCatchup({
    id,
    isGroup,
    socket,
    setChatMessages,
    mergeUnique,
    skipInitialCatchup,
  });

  return { socket, typingUserIds, sendTyping };
};
