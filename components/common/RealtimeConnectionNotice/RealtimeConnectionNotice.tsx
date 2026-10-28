"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

type RealtimeConnectionNoticeProps = {
  userId?: string | null;
};

export default function RealtimeConnectionNotice({
  userId,
}: RealtimeConnectionNoticeProps) {
  const { socket } = useSocket({
    subscribeOnline: false,
    enabled: Boolean(userId),
  });
  const [connectionError, setConnectionError] = useState("");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      setConnectionError("");
      setDismissed(false);
    };
    const handleConnectError = (error: Error) => {
      setConnectionError(
        /timed?\s*out|timeout/i.test(error.message)
          ? "The realtime connection timed out. Check your internet connection. If this keeps happening, the server may be unable to reach its database."
          : "Realtime updates are temporarily unavailable. The app will keep trying to reconnect.",
      );
      setDismissed(false);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleConnectError);
    };
  }, [socket]);

  if (!userId || !connectionError || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[10000] mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-amber-200 bg-white p-4 shadow-xl shadow-black/15"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <WifiOff className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">
          Realtime connection problem
        </p>
        <p className="mt-1 text-sm leading-5 text-slate-600">
          {connectionError}
        </p>
        <button
          type="button"
          onClick={() => {
            setConnectionError("");
            setDismissed(false);
            socket?.connect();
          }}
          className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry connection
        </button>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss connection notice"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-500/20"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
