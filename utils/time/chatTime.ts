import { format } from "date-fns";

export const formatChatListTime = (value?: string | Date | null): string => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return "";

  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return format(date, "h:mm a").toLowerCase();
  }

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  return format(date, "MM/dd/yyyy");
};
