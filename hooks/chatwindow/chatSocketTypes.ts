import type { Dispatch, SetStateAction } from "react";
import type { ChatMessage } from "@/components/pages/ChatWindow/ChatWindowTypes";

export type SocketListener = (
  event: string,
  handler: (...args: never[]) => void,
) => void;

export type ChatMessageSetter = Dispatch<SetStateAction<ChatMessage[]>>;
export type ChatMessageMerger = (
  previous: ChatMessage[],
  incoming: ChatMessage[],
) => ChatMessage[];
