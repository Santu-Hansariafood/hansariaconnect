// Common types for API routes

export interface SessionData {
  id: string | unknown;
  mobile?: string;
}

export interface UserSession {
  id: string;
  mobile?: string;
}

export interface MessageDocument {
  _id: unknown;
  from: unknown;
  to: unknown;
  type: string;
  text?: string;
  mediaUrl?: string;
  fileName?: string;
  fileSize?: string;
  duration?: number;
  linkTitle?: string;
  linkDescription?: string;
  status?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ConversationDocument {
  userA: unknown;
  userB: unknown;
  lastMessageAt?: Date;
  createdAt?: Date;
}

export interface ProfileDocument {
  _id?: unknown;
  userId: unknown;
  name?: string;
  photo?: string;
  about?: string;
  theme?: {
    wallpaper?: string;
    primary?: string;
    textSize?: string;
  };
}

export interface UserDocument {
  _id: unknown;
  mobile: string;
  otp?: string;
}

export interface ContactDocument {
  _id?: unknown;
  userId: unknown;
  name: string;
  mobiles: string[];
  email?: string;
  avatar?: string;
}

export interface MessageQuery {
  $or: Array<{ from: unknown; to: unknown }>;
  createdAt?: { $lt: Date };
}

export type MessageSort = Record<string, 1 | -1>;

