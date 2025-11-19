export interface Contact {
  id: number
  name: string
  mobile: string
  avatar: string
  lastMessage: string
  lastMessageTime: string
  lastSeen: string
  online: boolean
  active: boolean
  blocked: boolean
  unread: number
  pinned: boolean
}

export interface Message {
  id: number
  contactId: number
  text?: string
  sender: "me" | "them"
  timestamp: string
  type: "text" | "voice" | "pdf" | "excel" | "link"
  status?: "delivered" | "seen"
  media?: string
  duration?: string
  fileName?: string
  fileSize?: string
  url?: string
  linkTitle?: string
  linkDescription?: string
}

export interface Status {
  id: number
  user: string
  avatar: string
  media: string
  type: "image" | "video"
  timestamp: string
  views: number
}

export interface Group {
  id: number
  name: string
  avatar: string
  members: string[]
  admin: string
  lastMessage: string
  lastMessageTime: string
}

export const contacts: Contact[] = [
  {
    id: 1,
    name: "Rajesh Kumar",
    mobile: "9876543210",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    lastMessage: "Hey, how are you?",
    lastMessageTime: "2024-01-15T10:30:00",
    lastSeen: "2 hours ago",
    online: true,
    active: true,
    blocked: false,
    unread: 2,
    pinned: false,
  },
  {
    id: 2,
    name: "Priya Sharma",
    mobile: "9876543211",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    lastMessage: "Thanks for the help!",
    lastMessageTime: "2024-01-15T09:15:00",
    lastSeen: "5 hours ago",
    online: false,
    active: false,
    blocked: false,
    unread: 0,
    pinned: true,
  },
  {
    id: 3,
    name: "Amit Patel",
    mobile: "9876543212",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    lastMessage: "See you tomorrow",
    lastMessageTime: "2024-01-14T18:45:00",
    lastSeen: "yesterday",
    online: false,
    active: false,
    blocked: false,
    unread: 1,
    pinned: false,
  },
  {
    id: 4,
    name: "Sneha Reddy",
    mobile: "9876543213",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop",
    lastMessage: "Great work on the project!",
    lastMessageTime: "2024-01-14T15:20:00",
    lastSeen: "yesterday",
    online: true,
    active: true,
    blocked: false,
    unread: 0,
    pinned: true,
  },
  {
    id: 5,
    name: "Vikram Singh",
    mobile: "9876543214",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop",
    lastMessage: "Can we meet next week?",
    lastMessageTime: "2024-01-13T12:00:00",
    lastSeen: "2 days ago",
    online: false,
    active: false,
    blocked: false,
    unread: 3,
    pinned: false,
  },
]

export const messages: Message[] = [
  {
    id: 1,
    contactId: 1,
    text: "Hey, how are you?",
    sender: "them",
    timestamp: "2024-01-15T10:25:00",
    type: "text",
  },
  {
    id: 2,
    contactId: 1,
    text: "I am doing great! Thanks for asking.",
    sender: "me",
    timestamp: "2024-01-15T10:26:00",
    type: "text",
  },
  {
    id: 3,
    contactId: 1,
    text: "What are you up to?",
    sender: "them",
    timestamp: "2024-01-15T10:30:00",
    type: "text",
    status: "delivered",
  },
  {
    id: 4,
    contactId: 1,
    sender: "me",
    timestamp: "2024-01-15T10:32:00",
    type: "voice",
    media: "https://example.com/voice.webm",
    duration: "15",
    status: "seen",
  },
  {
    id: 5,
    contactId: 1,
    text: "Check this document",
    sender: "me",
    timestamp: "2024-01-15T10:35:00",
    type: "pdf",
    fileName: "Project_Report.pdf",
    fileSize: "2.5 MB",
    status: "seen",
  },
  {
    id: 6,
    contactId: 2,
    text: "Thanks for the help!",
    sender: "them",
    timestamp: "2024-01-15T09:15:00",
    type: "text",
    status: "delivered",
  },
  {
    id: 7,
    contactId: 2,
    text: "Anytime! Happy to help.",
    sender: "me",
    timestamp: "2024-01-15T09:16:00",
    type: "text",
    status: "seen",
  },
  {
    id: 8,
    contactId: 2,
    text: "Here is the data you requested",
    sender: "me",
    timestamp: "2024-01-15T09:18:00",
    type: "excel",
    fileName: "Sales_Data_Q4.xlsx",
    fileSize: "1.8 MB",
    status: "delivered",
  },
  {
    id: 9,
    contactId: 3,
    sender: "them",
    timestamp: "2024-01-14T18:40:00",
    type: "link",
    url: "https://github.com/example/project",
    linkTitle: "GitHub Repository",
    linkDescription: "Check out this awesome project!",
    text: "Found this interesting project",
    status: "seen",
  },
  {
    id: 10,
    contactId: 3,
    text: "Looks great!",
    sender: "me",
    timestamp: "2024-01-14T18:45:00",
    type: "text",
    status: "seen",
  },
]

export const statuses: Status[] = [
  {
    id: 1,
    user: "Rajesh Kumar",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop",
    media: "https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?w=800&h=1200&fit=crop",
    type: "image",
    timestamp: "2024-01-15T08:00:00",
    views: 45,
  },
  {
    id: 2,
    user: "Priya Sharma",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop",
    media: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&h=1200&fit=crop",
    type: "image",
    timestamp: "2024-01-15T07:30:00",
    views: 32,
  },
  {
    id: 3,
    user: "Amit Patel",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop",
    media: "https://images.unsplash.com/photo-1511884642898-4c92249e20b6?w=800&h=1200&fit=crop",
    type: "video",
    timestamp: "2024-01-14T20:00:00",
    views: 28,
  },
]

export const groups: Group[] = [
  {
    id: 101,
    name: "Family Group",
    avatar: "https://images.unsplash.com/photo-1511895426328-dc8714191300?w=400&h=400&fit=crop",
    members: ["9876543210", "9876543211", "9876543212", "9876543213"],
    admin: "9876543210",
    lastMessage: "Dinner plans for Sunday?",
    lastMessageTime: "2024-01-15T11:00:00",
  },
  {
    id: 102,
    name: "Project Team",
    avatar: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=400&fit=crop",
    members: ["9876543210", "9876543212", "9876543214"],
    admin: "9876543210",
    lastMessage: "Meeting at 3 PM tomorrow",
    lastMessageTime: "2024-01-15T09:30:00",
  },
  {
    id: 103,
    name: "College Friends",
    avatar: "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=400&fit=crop",
    members: ["9876543210", "9876543211", "9876543213", "9876543214"],
    admin: "9876543211",
    lastMessage: "Reunion planning!",
    lastMessageTime: "2024-01-14T16:00:00",
  },
]
