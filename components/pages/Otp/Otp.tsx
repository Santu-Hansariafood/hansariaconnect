"use client";

import { useRef, useState, useEffect, FormEvent, KeyboardEvent, Suspense } from "react";
import { motion } from "framer-motion";
import { fadeIn } from "@/utils/animations/animations";
import Image from "next/image";
import Loading from "@/components/common/Loading/Loading";
import { ClipboardPaste, LoaderCircle, ShieldCheck } from "lucide-react";

type OtpProps = {
  onVerify: (code: string) => void | Promise<void>;
  /**
   * Requests a fresh code. Resolves with an error message to display, or null
   * when a new code was sent.
   */
  onResend?: () => Promise<string | null>;
  mobile: string;
  email?: string;
  serverError?: string;
};

const RESEND_COOLDOWN_SECONDS = 30;

const Otp: React.FC<OtpProps> = ({
  onVerify,
  onResend,
  mobile,
  email,
  serverError,
}) => {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendNotice, setResendNotice] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const code = digits.join("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!onResend || isResending || cooldown > 0) return;

    setIsResending(true);
    setError("");
    setResendNotice("");

    try {
      const failure = await onResend();
      if (failure) {
        setError(failure);
        return;
      }
      setResendNotice(`A new code was sent to ${email || mobile}.`);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setIsResending(false);
    }
  };

  const fillCode = (value: string, focusIndex = 5) => {
    const nextDigits = value.replace(/\D/g, "").slice(0, 6).split("");
    setDigits(Array.from({ length: 6 }, (_, index) => nextDigits[index] || ""));
    setError("");
    inputRefs.current[Math.min(nextDigits.length, focusIndex)]?.focus();
  };

  const handlePasteCode = async () => {
    setError("");

    if (!navigator.clipboard?.readText) {
      setError("Clipboard access is unavailable. Paste the code into the field instead.");
      return;
    }

    try {
      const clipboardText = await navigator.clipboard.readText();
      const match = clipboardText.match(/(?:^|\D)(\d{6})(?:\D|$)/);
      if (!match) {
        setError("No 6-digit code was found in your clipboard.");
        return;
      }

      fillCode(match[1]);
    } catch {
      setError("Clipboard access was blocked. Paste the code into the field instead.");
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    const enteredDigits = value.replace(/\D/g, "");
    if (!enteredDigits) {
      setDigits((current) =>
        current.map((digit, digitIndex) => (digitIndex === index ? "" : digit)),
      );
      setError("");
      return;
    }

    if (enteredDigits.length > 1) {
      const nextDigits = [...digits];
      enteredDigits
        .slice(0, 6 - index)
        .split("")
        .forEach((digit, offset) => {
          nextDigits[index + offset] = digit;
        });
      setDigits(nextDigits);
      setError("");
      inputRefs.current[Math.min(index + enteredDigits.length, 5)]?.focus();
      return;
    }

    setDigits((current) =>
      current.map((digit, digitIndex) => (digitIndex === index ? enteredDigits : digit)),
    );
    setError("");
    if (index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleDigitKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (/^\d{6}$/.test(code)) {
      setError("");
      setIsVerifying(true);
      try {
        await onVerify(code);
      } finally {
        setIsVerifying(false);
      }
    } else {
      setError(
        `Enter the 6-digit code sent to your ${email ? "email" : "phone"}`,
      );
    }
  };

  return (
    <Suspense fallback={<Loading />}>
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f3f8f6] p-4">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-200/50 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-teal-200/50 blur-3xl" />
        <motion.div
          {...fadeIn}
          className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/80 bg-white p-7 shadow-[0_24px_80px_-28px_rgba(15,118,90,0.3)] sm:p-10"
        >
          <div className="mb-8 text-center">
            <div className="relative mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-gradient-to-br from-emerald-50 to-teal-100 shadow-inner">
              <Image
                src="/logo/logo.png"
                alt="HansariaConnect Logo"
                width={64}
                height={64}
                className="rounded-full object-cover"
              />
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-emerald-600 text-white shadow-sm">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              Secure verification
            </p>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Check your {email ? "email" : "phone"}
            </h2>
            <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-gray-500">
              Enter the 6-digit code we sent to{" "}
              <span className="font-semibold text-gray-700">{email || mobile}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <span id="otp-code-label" className="text-sm font-semibold text-gray-700">
                  Verification code
                </span>
                <button
                  type="button"
                  onClick={handlePasteCode}
                  disabled={isVerifying}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
                  Paste OTP
                </button>
              </div>
              <div
                role="group"
                aria-labelledby="otp-code-label"
                aria-describedby={error || serverError ? "otp-error" : undefined}
                className="flex justify-center gap-2.5 sm:gap-3"
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    pattern="[0-9]*"
                    aria-label={`Digit ${index + 1} of 6`}
                    value={digit}
                    onChange={(event) => handleDigitChange(index, event.target.value)}
                    onKeyDown={(event) => handleDigitKeyDown(index, event)}
                    onPaste={(event) => {
                      event.preventDefault();
                      fillCode(event.clipboardData.getData("text"), index);
                    }}
                    className="h-12 w-11 rounded-xl border-2 border-gray-200 bg-gray-50/70 text-center text-xl font-semibold text-gray-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 sm:h-14 sm:w-12 sm:rounded-2xl sm:text-2xl"
                    maxLength={6}
                    required
                  />
                ))}
              </div>
              {(error || serverError) && (
                <motion.p
                  id="otp-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700"
                >
                  {error || serverError}
                </motion.p>
              )}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isVerifying || code.length !== 6}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {isVerifying ? (
                <>
                  <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
                  Verifying...
                </>
              ) : (
                "Verify and continue"
              )}
            </motion.button>
          </form>

          {onResend && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || cooldown > 0}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent"
              >
                {isResending ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending a new code...
                  </>
                ) : cooldown > 0 ? (
                  `Resend code in ${cooldown}s`
                ) : (
                  "Didn't get the code? Resend"
                )}
              </button>
              {resendNotice && (
                <p role="status" className="mt-1 text-xs font-medium text-emerald-700">
                  {resendNotice}
                </p>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-xs leading-5 text-gray-400">
            Your code expires after 5 minutes. Never share it with anyone.
          </p>
        </motion.div>
      </div>
    </Suspense>
  );
};

export default Otp;
