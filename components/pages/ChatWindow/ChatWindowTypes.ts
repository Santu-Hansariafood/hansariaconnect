export interface Theme {
  primary: string;
  secondary?: string;
  textSize?: string;
  wallpaper?: string;
  wallpaperImage?: string;
}

export interface User {
  id: number;
  name: string;
  avatar: string;
}

export interface ContactInfo {
  _id?: string;
  id?: string;
  registeredUserId?: string;
  name?: string;
  avatar?: string;
  mobile?: string;
  online?: boolean;
  lastSeen?: string;
  registeredProfile?: {
    name?: string;
    photo?: string;
  };
}

export type MessageType =
  | "text"
  | "image"
  | "video"
  | "voice"
  | "pdf"
  | "excel"
  | "link"
  | "file";

export interface ChatMessage {
  _id?: string;
  id?: string;
  from?: string | { toString?: () => string };
  to?: string;
  type?: MessageType;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  linkTitle?: string;
  linkDescription?: string;
  duration?: number;
  status?: "sent" | "delivered" | "seen" | "sending" | "failed";
  reactions?: Record<string, number>;
  createdAt?: string | Date;
  timestamp?: string | Date;
}

export interface GroupMember {
  id: string;
  name: string;
  avatar?: string;
}

export interface ForwardContact {
  id: string;
  name: string;
  mobile: string;
  avatar: string;
}
