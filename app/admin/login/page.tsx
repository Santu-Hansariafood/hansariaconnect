"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function AdminLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const sendOtp = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || "Failed to send code")
      } else {
        setSent(true)
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const verify = async () => {
    setError("")
    setLoading(true)
    try {
      const res = await fetch("/api/admin/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setError(data?.error || "Invalid code")
      } else {
        router.replace("/admin")
      }
    } catch {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4"
         style={{ background: "radial-gradient(1200px 600px at 10% 10%, #ecfeff 0%, transparent 60%), radial-gradient(1200px 600px at 90% 90%, #eef2ff 0%, transparent 60%), linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)" }}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full blur-3xl opacity-40" style={{ background: "conic-gradient(from 180deg at 50% 50%, #10b981, #3b82f6, #f59e0b, #ec4899, #10b981)" }} />
        <div className="absolute -bottom-24 -right-24 w-[26rem] h-[26rem] rounded-full blur-3xl opacity-30" style={{ background: "conic-gradient(from 90deg at 50% 50%, #8b5cf6, #06b6d4, #22c55e, #f97316, #8b5cf6)" }} />
      </div>

      <div className="w-full max-w-md relative bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-[0_10px_40px_rgba(16,185,129,0.15)] p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl" style={{ background: "linear-gradient(135deg, #10b981, #3b82f6)" }} />
          <h1 className="text-2xl font-extrabold tracking-tight" style={{ background: "linear-gradient(90deg, #0ea5e9, #22c55e, #f59e0b)", WebkitBackgroundClip: "text", color: "transparent" }}>
            HansariaConnect Admin
          </h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">Sign in securely with a one-time code.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Email</label>
            <input
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={email}
              disabled={sent}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          {!sent ? (
            <button
              onClick={sendOtp}
              disabled={loading || !email}
              className="w-full py-3 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-60"
              style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)" }}
            >
              {loading ? "Sending..." : "Send Code"}
            </button>
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Enter Code</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-500 tracking-[0.4em] text-center"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                />
              </div>
              <button
                onClick={verify}
                disabled={loading || code.length !== 6}
                className="w-full py-3 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-60"
                style={{ background: "linear-gradient(90deg, #3b82f6, #8b5cf6)" }}
              >
                {loading ? "Verifying..." : "Verify & Continue"}
              </button>
              <button
                onClick={() => { setSent(false); setCode("") }}
                className="w-full py-2 text-sm text-emerald-700 hover:underline"
              >
                Use a different email
              </button>
            </>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </div>
      </div>
    </div>
  )
}
