"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuperSubdomain, setIsSuperSubdomain] = useState(false);

  useEffect(() => {
    // Check if we're on super. subdomain
    const host = window.location.host;
    setIsSuperSubdomain(/^super\./i.test(host));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Login failed");
        return;
      }

      // If on super subdomain, ensure the logged in user is a super admin
      if (isSuperSubdomain && !data.admin.isSuperAdmin) {
        setError("Only super admins can access this subdomain");
        return;
      }

      router.replace("/admin");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

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
            HansariaConnect {isSuperSubdomain ? "Super Admin" : "Admin"}
          </h1>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          {isSuperSubdomain ? "Sign in as Super Admin" : "Sign in with User ID or Email and Password"}
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">User ID or Email</label>
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Enter User ID or Email"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white/70 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-2xl text-white font-semibold shadow-lg disabled:opacity-60"
            style={{ background: "linear-gradient(90deg, #10b981, #06b6d4)" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
