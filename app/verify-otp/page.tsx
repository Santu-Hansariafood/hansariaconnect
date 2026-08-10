"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/context/AppContext/AppContext";
import { Suspense, useCallback, useEffect, useState } from "react";
import Loading from "@/components/common/Loading/Loading";
import dynamic from "next/dynamic";
const Otp = dynamic(() => import("@/components/pages/Otp/Otp"), { ssr: false });

function VerifyOtpInner() {
  const searchParams = useSearchParams();
  const mobile = searchParams?.get("mobile") ?? "";
  const email = searchParams?.get("email") ?? "";
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
          credentials: "include",
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
          if (data.notRegistered) {
            router.replace(`/login?mobile=${mobile}&reason=not-registered`);
          } else {
            setServerError(data.error || "Invalid code");
          }
        }
      } catch {
        setServerError("Invalid code");
      }
    },
    [mobile, setUser, router]
  );

  return (
    <Otp
      mobile={mobile}
      email={email || undefined}
      onVerify={handleVerify}
      serverError={serverError}
    />
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<Loading />}> 
      <VerifyOtpInner />
    </Suspense>
  );
}
