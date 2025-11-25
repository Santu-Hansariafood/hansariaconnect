"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import { useCallback, useEffect, useState } from "react";
import Otp from "@/components/pages/Otp/Otp";

export default function VerifyOtpPage() {
  const searchParams = useSearchParams();
  const mobile = searchParams?.get("mobile") ?? ""; // ✅ FIXED
  const { setUser } = useApp();
  const router = useRouter();
  const [serverError, setServerError] = useState("");

  useEffect(() => {
    if (!mobile) {
      router.replace("/login");
    }
  }, [mobile, router]);

  if (!mobile) return null;

  const handleVerify = useCallback(
    async (code: string) => {
      setServerError("");

      try {
        const res = await fetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, code }),
        });

        const data = await res.json();

        if (data.success) {
          const userData = {
            id: data.userId as string,
            mobile,
            step: "complete" as const,
          };

          setUser(userData);
          localStorage.setItem("hansariaUser", JSON.stringify(userData));

          router.push("/profile");
        } else {
          setServerError(data.error || "Invalid code");
        }
      } catch {
        setServerError("Invalid code");
      }
    },
    [mobile, setUser, router]
  );

  const handleResend = useCallback(async () => {
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    });
  }, [mobile]);

  return (
    <Otp
      mobile={mobile}
      onVerify={handleVerify}
      onResend={handleResend}
      serverError={serverError}
    />
  );
}
