"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { CheckCircle2, LoaderCircle, QrCode, X } from "lucide-react";

const getLoginToken = (value: string): string | null => {
  try {
    const url = new URL(value);
    const appHost = window.location.hostname.replace(/^web\./i, "");
    const qrHost = url.hostname.replace(/^web\./i, "");
    if (
      url.pathname !== "/scan" ||
      url.protocol !== window.location.protocol ||
      qrHost !== appHost
    ) {
      return null;
    }

    const token = url.searchParams.get("token") || "";
    return /^[a-f0-9]{64}$/i.test(token) ? token : null;
  } catch {
    return null;
  }
};

export default function MobileQrLoginScanner({
  onClose,
}: {
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const reader = new BrowserQRCodeReader();

    const startCamera = async () => {
      try {
        const controls = await reader.decodeFromConstraints(
          {
            audio: false,
            video: { facingMode: { ideal: "environment" } },
          },
          videoRef.current || undefined,
          (result) => {
            if (!result || cancelled || processingRef.current) return;
            const token = getLoginToken(result.getText());
            if (!token) {
              setError("This is not a HansariaConnect web login QR code.");
              return;
            }

            processingRef.current = true;
            controlsRef.current?.stop();
            setApproving(true);
            setError("");
            void (async () => {
              try {
                const response = await fetch("/api/auth/scan/link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ token }),
                });
                const data = await response.json();
                if (!response.ok) {
                  throw new Error(data?.error || "Could not approve this login.");
                }
                if (!cancelled) setApproved(true);
              } catch (approveError) {
                if (!cancelled) {
                  setError(
                    approveError instanceof Error
                      ? approveError.message
                      : "Could not approve this login.",
                  );
                  processingRef.current = false;
                }
              } finally {
                if (!cancelled) setApproving(false);
              }
            })();
          },
        );

        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (cameraError) {
        if (!cancelled) {
          console.error("Could not start QR login scanner:", cameraError);
          setError(
            "Camera access is unavailable. Allow camera permission and try again.",
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    };

    void startCamera();
    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mobile-qr-login-title"
    >
      <section className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-center justify-between bg-[#075e54] px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <QrCode className="h-6 w-6" aria-hidden="true" />
            <div>
              <h2 id="mobile-qr-login-title" className="font-semibold">
                Scan to log in on web
              </h2>
              <p className="text-xs text-white/80">
                Scan the QR code shown on your computer
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 transition hover:bg-white/10"
            aria-label="Close QR scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {approved ? (
            <div className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-4 text-emerald-800">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Login approved</p>
                <p className="mt-1 text-sm">
                  Your browser will finish signing in automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-slate-950">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
              />
              <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-300 shadow-[0_0_0_999px_rgba(0,0,0,0.2)]" />
              {(starting || approving) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-sm text-white">
                  <LoaderCircle className="h-7 w-7 animate-spin" />
                  {approving ? "Approving login…" : "Starting camera…"}
                </div>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
          {!approved && !error && (
            <p className="text-center text-sm text-slate-600">
              Only approve a login you started on your own computer.
            </p>
          )}
          {approved && (
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full bg-[#00a884] px-4 py-3 font-semibold text-white hover:bg-[#008f72]"
            >
              Done
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
