"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import LinkedDevices from "@/components/pages/Profile/LinkedDevices";
import { MAX_DEVICE_SESSIONS } from "@/lib/auth/deviceLimits";

type Account = {
  name?: string;
  mobile: string;
};

export default function ScanLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token") || "";
  const returnTo = `/scan?${new URLSearchParams({ token }).toString()}`;
  const isValidToken = /^[a-f0-9]{64}$/i.test(token);
  const [account, setAccount] = useState<Account | null>(null);
  const [deviceCount, setDeviceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approved, setApproved] = useState(false);
  const [error, setError] = useState("");

  const handleDevicesChange = useCallback((count: number) => {
    setDeviceCount(count);
  }, []);

  useEffect(() => {
    if (!isValidToken) return;

    let cancelled = false;
    const loadAccount = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const data = await response.json();
        if (response.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (!response.ok || !data?.user?.mobile) {
          throw new Error(data?.error || "Could not verify the signed-in account.");
        }
        if (!cancelled) setAccount(data.user);
      } catch (loadError) {
        console.error("Could not load account for QR login:", loadError);
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not verify your account.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, [isValidToken, returnTo, router, token]);

  const approveLogin = async () => {
    if (deviceCount >= MAX_DEVICE_SESSIONS) {
      setError("You have reached the 5-device limit. Log out another device below, then approve again.");
      return;
    }

    setApproving(true);
    setError("");
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
      setApproved(true);
    } catch (approveError) {
      console.error("Could not approve QR login:", approveError);
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Could not approve this login.",
      );
    } finally {
      setApproving(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#efeae2] px-4 py-10">
      <section className="mx-auto max-w-xl overflow-hidden rounded-3xl bg-white shadow-xl">
        <header className="bg-[#075e54] px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            <div>
              <h1 className="text-xl font-semibold">Link a device</h1>
              <p className="mt-1 text-sm text-white/80">
                Confirm this login only if you started it.
              </p>
            </div>
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-6">
          {loading ? (
            <div className="flex items-center gap-3 py-4 text-sm text-[#54656f]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Checking your account…
            </div>
          ) : !isValidToken ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              This login QR code is invalid. Return to your computer and refresh it.
            </p>
          ) : account ? (
            <>
              <div className="rounded-2xl bg-[#f0f2f5] p-4">
                <p className="text-sm font-semibold text-[#111b21]">
                  Approve sign-in for {account.name || account.mobile}
                </p>
                <p className="mt-1 text-sm text-[#54656f]">
                  Account ending in {account.mobile.slice(-4)}
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              )}

              {approved ? (
                <div className="flex items-start gap-3 rounded-2xl bg-[#e7f8f1] p-4 text-[#075e54]">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Login approved</p>
                    <p className="mt-1 text-sm">
                      The browser will finish signing in automatically. You can
                      close this page.
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void approveLogin()}
                  disabled={approving || deviceCount >= MAX_DEVICE_SESSIONS}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-[#00a884] px-5 py-3 font-semibold text-white transition hover:bg-[#008f72] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {approving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  Approve login
                </button>
              )}

              <LinkedDevices onDevicesChange={handleDevicesChange} />
            </>
          ) : !error ? (
            <p className="py-4 text-sm text-[#54656f]">
              Redirecting you to sign in…
            </p>
          ) : (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
