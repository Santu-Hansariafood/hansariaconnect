"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Lock, User, Loader2 } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuperSubdomain, setIsSuperSubdomain] = useState(false);

  useEffect(() => {
    const host = window.location.host;
    setIsSuperSubdomain(/^super\./i.test(host));
    const checkExistingSession = async () => {
      try {
        const res = await fetch("/api/admin/me", {
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            router.replace("/admin");
          }
        }
      } catch {}
    };

    checkExistingSession();
  }, [router]);

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-emerald-400/20 to-transparent rounded-full blur-3xl transform -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] bg-gradient-to-tr from-blue-500/20 to-transparent rounded-full blur-3xl transform translate-x-1/3 translate-y-1/3" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/90 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl p-8 sm:p-10">
          <div className="mb-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-blue-700 via-emerald-600 to-amber-500 bg-clip-text text-transparent">
              HansariaConnect
            </h1>
            <p className="text-lg font-semibold text-slate-700 mt-2">
              {isSuperSubdomain ? "Super Admin Portal" : "Admin Portal"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              Sign in to access the admin dashboard
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <User className="w-4 h-4 text-slate-500" />
                User ID or Email
              </label>
              <div className="relative">
                <input
                  type="text"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin or superadmin"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  className="w-full px-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl text-white font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-600 hover:to-blue-700"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in...
                </div>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              {isSuperSubdomain
                ? "Use superadmin credentials to access this portal"
                : "Use admin credentials to access this portal"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
