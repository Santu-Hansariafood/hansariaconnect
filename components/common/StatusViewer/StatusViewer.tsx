"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

type Item = { id: string; media: string; type: "image" | "video"; user?: string };

export default function StatusViewer({
  items,
  startIndex = 0,
  onClose,
}: {
  items: Item[];
  startIndex?: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);

  useEffect(() => {
    setIndex(startIndex);
  }, [startIndex]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [index]);

  const next = () => setIndex((i) => Math.min(i + 1, items.length - 1));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  if (!items || items.length === 0) return null;

  const cur = items[index];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
      <div className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-6">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 bg-black/50 text-white rounded-full p-2"
        >
          Close
        </button>

        <div className="flex items-center justify-between absolute inset-y-0 left-0 w-full pointer-events-none">
          <button onClick={prev} className="pointer-events-auto p-4 text-white">‹</button>
          <button onClick={next} className="pointer-events-auto p-4 text-white">›</button>
        </div>

        <div className="flex min-h-[70dvh] w-full flex-1 items-center justify-center overflow-hidden bg-black sm:min-h-0 sm:h-[78vh]">
          {cur.type === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cur.media} alt={cur.user || "status"} className="max-w-full max-h-full object-contain" />
          ) : (
            <video src={cur.media} controls className="max-w-full max-h-full" />
          )}
        </div>

        <div className="mt-3 text-white text-center">
          <div className="text-sm">{cur.user}</div>
          <div className="text-xs opacity-80">{index + 1} / {items.length}</div>
        </div>
      </div>
    </div>
  );
}
