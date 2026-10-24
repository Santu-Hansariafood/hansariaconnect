"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface VoicePlayerProps {
  src: string;
  /** Duration captured while recording; the audio element refines it once loaded. */
  duration?: number;
}

const BAR_COUNT = 34;
const SPEED_STEPS = [1, 1.5, 2] as const;

/**
 * Only one voice note should ever be audible, so every mounted player pauses
 * the previously started one before it plays.
 */
let currentlyPlaying: HTMLAudioElement | null = null;

const formatClock = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

/**
 * Deterministic pseudo-waveform: the same clip always draws the same bars, so
 * the shape does not jump around on every re-render.
 */
const buildWaveform = (seed: string) => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }

  return Array.from({ length: BAR_COUNT }, (_, index) => {
    hash = (hash * 1103515245 + 12345) % 2147483648;
    const noise = (hash / 2147483648) * 0.7 + 0.3;
    // Taper the ends slightly so the clip reads as a soft speech envelope.
    const edge = Math.min(index, BAR_COUNT - 1 - index) / (BAR_COUNT / 6) + 0.35;
    return Math.min(1, noise * Math.min(1, edge));
  });
};

export default function VoicePlayer({ src, duration }: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [hasError, setHasError] = useState(false);

  const totalDuration = loadedDuration || duration || 0;
  const speed = SPEED_STEPS[speedIndex];
  const waveform = useMemo(() => buildWaveform(src), [src]);

  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const playedBars = Math.round(progress * BAR_COUNT);

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      if (currentlyPlaying && currentlyPlaying !== audio) {
        currentlyPlaying.pause();
      }
      currentlyPlaying = audio;
      void audio.play().catch(() => setHasError(true));
    } else {
      audio.pause();
    }
  }, []);

  const seekTo = useCallback(
    (clientX: number) => {
      const audio = audioRef.current;
      const track = waveformRef.current;
      if (!audio || !track || totalDuration <= 0) return;

      const bounds = track.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      audio.currentTime = ratio * totalDuration;
      setCurrentTime(audio.currentTime);
    },
    [totalDuration],
  );

  const cycleSpeed = useCallback(() => {
    const nextIndex = (speedIndex + 1) % SPEED_STEPS.length;
    setSpeedIndex(nextIndex);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEED_STEPS[nextIndex];
    }
  }, [speedIndex]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (currentlyPlaying === audio) currentlyPlaying = null;
    };
  }, []);

  if (!src) {
    return (
      <div className="flex min-w-[180px] items-center gap-3 rounded-xl bg-black/5 p-3 text-sm opacity-80">
        <Play className="h-4 w-4" />
        <span>Voice message unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex min-w-[180px] w-full max-w-[320px] min-w-0 items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          togglePlayback();
        }}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-sm transition active:scale-95"
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" fill="currentColor" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px]" fill="currentColor" />
        )}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          cycleSpeed();
        }}
        aria-label={`Playback speed ${speed}x`}
        className="h-6 shrink-0 rounded-full px-1.5 text-[11px] font-semibold text-[#667781] transition hover:bg-black/5"
      >
        {speed}x
      </button>

      <div
        ref={waveformRef}
        onClick={(event) => {
          event.stopPropagation();
          seekTo(event.clientX);
        }}
        role="slider"
        aria-label="Voice message position"
        aria-valuemin={0}
        aria-valuemax={Math.round(totalDuration)}
        aria-valuenow={Math.round(currentTime)}
        tabIndex={0}
        className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-[2px]"
      >
        {waveform.map((height, index) => (
          <span
            key={index}
            style={{ height: `${Math.round(height * 100)}%` }}
            className={`w-[2px] shrink-0 rounded-full transition-colors ${
              index < playedBars ? "bg-[var(--brand-primary)]" : "bg-[#111b21]/25"
            }`}
          />
        ))}
      </div>

      <span className="shrink-0 tabular-nums text-[11px] font-medium text-[#667781]">
        {hasError ? "Unavailable" : isPlaying ? formatClock(currentTime) : formatClock(totalDuration)}
      </span>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(event) => {
          setLoadedDuration(event.currentTarget.duration || 0);
          event.currentTarget.playbackRate = SPEED_STEPS[speedIndex];
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={(event) => {
          setIsPlaying(false);
          setCurrentTime(0);
          event.currentTarget.currentTime = 0;
          if (currentlyPlaying === event.currentTarget) currentlyPlaying = null;
        }}
        onError={() => setHasError(true)}
        className="hidden"
      />
    </div>
  );
}
