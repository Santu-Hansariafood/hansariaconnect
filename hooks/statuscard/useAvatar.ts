"use client";

export const useAvatar = (avatar?: string) => {
  const fallback =
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop";

  const finalAvatar =
    avatar && avatar.trim().length > 0 ? avatar : fallback;

  return finalAvatar;
};
