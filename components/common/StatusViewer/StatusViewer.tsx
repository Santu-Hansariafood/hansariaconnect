"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

import { useAvatar } from "@/hooks/statuscard/useAvatar";
import { useTimeAgo } from "@/hooks/statuscard/useTimeAgo";

type Item = {
  id: string;
  media: string;
  type: "image" | "video";
  user?: string;
  avatar?: string;
  timestamp?: string | number | Date;
};

const IMAGE_DURATION_MS = 5000;
const FALLBACK_TIMESTAMP = new Date(0).toISOString();

export default function StatusViewer({
  items,
  startIndex = 0,
  onClose,
  onView,
}: {
  items: Item[];
  startIndex?: number;
  onClose: () => void;
  onView?: (statusId: string) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [isPaused, setIsPaused] = useState(false);

  const elapsedRef = useRef(0);
  const viewedRef = useRef<Set<string>>(new Set());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const barsContainerRef = useRef<HTMLDivElement | null>(null);

  const activeItem = items[index];
  const avatarSrc = useAvatar(activeItem?.avatar);
  const timeAgo = useTimeAgo(activeItem?.timestamp ?? FALLBACK_TIMESTAMP);

  const drawProgress = useCallback(
    (value: number) => {
      const track = barsContainerRef.current?.children[index] as
        | HTMLElement
        | undefined;
      const bar = track?.firstElementChild as HTMLElement | null;
      if (bar) {
        bar.style.width = `${Math.max(0, Math.min(value, 1)) * 100}%`;
      }
    },
    [index],
  );

  const goNext = useCallback(() => {
    if (index + 1 >= items.length) {
      onClose();
      return;
    }
    setIndex(index + 1);
  }, [index, items.length, onClose]);

  const goPrevious = useCallback(() => {
    if (index === 0) {
      elapsedRef.current = 0;
      drawProgress(0);
      return;
    }
    setIndex(index - 1);
  }, [index, drawProgress]);

  useEffect(() => {
    elapsedRef.current = 0;
    const tracks = barsContainerRef.current?.children;
    if (!tracks) return;
    Array.from(tracks).forEach((track, trackIndex) => {
      const bar = track.firstElementChild as HTMLElement | null;
      if (bar) {
        bar.style.width = trackIndex < index ? "100%" : "0%";
      }
    });
  }, [index]);

  useEffect(() => {
    const item = items[index];
    if (!item || !onView) return;
    if (viewedRef.current.has(item.id)) return;
    viewedRef.current.add(item.id);
    onView(item.id);
  }, [index, items, onView]);

  useEffect(() => {
    const item = items[index];
    if (!item || item.type === "video" || isPaused) return;

    let frame = 0;
    let lastTick = performance.now();
    const step = (now: number) => {
      elapsedRef.current += now - lastTick;
      lastTick = now;
      const nextProgress = elapsedRef.current / IMAGE_DURATION_MS;
      drawProgress(nextProgress);
      if (nextProgress >= 1) {
        goNext();
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [index, items, isPaused, goNext, drawProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isPaused) {
      video.pause();
      return;
    }
    video.play().catch(() => {
      video.muted = true;
      video.play().catch((error: unknown) => {
        console.warn("[StatusViewer] Video playback could not start:", error);
      });
    });
  }, [isPaused, index, activeItem?.media]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrevious();
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrevious, onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!items.length) return null;

  const nextItem = items[index + 1];

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="relative mx-auto flex h-[100dvh] w-full max-w-3xl flex-col">
        <div
          ref={barsContainerRef}
          className="flex gap-1 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))]"
        >
          {items.map((item) => (
            <div
              key={item.id}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30"
            >
              <div className="h-full w-0 rounded-full bg-white" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 px-3 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={activeItem?.user || "Status"}
            className="h-9 w-9 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">
              {activeItem?.user || "Status"}
            </p>
            <p className="text-xs text-white/70">{timeAgo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close status"
            className="rounded-full p-2 text-white transition hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          onPointerDown={() => setIsPaused(true)}
          onPointerUp={() => setIsPaused(false)}
          onPointerLeave={() => setIsPaused(false)}
          onPointerCancel={() => setIsPaused(false)}
        >
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={activeItem?.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center"
            >
              {activeItem?.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeItem.media}
                  alt={activeItem.user || "Status"}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={activeItem?.media}
                  playsInline
                  autoPlay
                  className="max-h-full max-w-full object-contain"
                  onTimeUpdate={(event) => {
                    const video = event.currentTarget;
                    if (video.duration) {
                      drawProgress(video.currentTime / video.duration);
                    }
                  }}
                  onEnded={goNext}
                />
              )}
            </motion.div>
          </AnimatePresence>

          <button
            type="button"
            onClick={goPrevious}
            aria-label="Previous status"
            className="absolute inset-y-0 left-0 w-1/3 cursor-default"
          />
          <button
            type="button"
            onClick={goNext}
            aria-label="Next status"
            className="absolute inset-y-0 right-0 w-2/3 cursor-default"
          />

          {isPaused && activeItem?.type === "image" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
              <span className="rounded-full bg-black/50 px-4 py-2 text-xs font-medium text-white">
                Hold to pause
              </span>
            </div>
          )}
        </div>

        {nextItem?.type === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={nextItem.media} alt="" className="hidden" />
        )}
      </div>
    </div>
  );
}
