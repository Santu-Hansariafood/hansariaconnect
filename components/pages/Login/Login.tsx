"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Phone, User, Mail, Calendar, Check, X, QrCode, RefreshCw } from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";
import Image from "next/image";
import QRCode from "react-qr-code";

const Login = () => {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "scan">("login");
    const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registerMobile, setRegisterMobile] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);

  const [scanToken, setScanToken] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const generateScanToken = async () => {
    setScanLoading(true);
    try {
      const res = await fetch("/api/auth/scan/generate", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setScanToken(data.token);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    if (mode === "scan") {
      generateScanToken();
    }
  }, [mode]);

  useEffect(() => {
    if (!scanToken) return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/scan/generate?token=${scanToken}`);
        const data = await res.json();

        if (data.success && data.ready && data.mobile) {
          const verifyRes = await fetch("/api/auth/scan/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: scanToken }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            router.push("/");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [scanToken, router]);

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!/^\d{10}$/.test(mobile)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devOtp) console.log("OTP:", data.devOtp);
        router.push(`/verify-otp?mobile=${mobile}`);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!name || !email || !registerMobile || !sex || !dob || !terms) {
      setError("Please fill all required fields and accept terms and conditions");
      return;
    }

    if (!/^\d{10}$/.test(registerMobile)) {
      setError("Please enter a valid 10-digit mobile number");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name, 
          email, 
          mobile: registerMobile, 
          sex, 
          dateOfBirth: dob, 
          termsAccepted: terms 
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devOtp) console.log("OTP:", data.devOtp);
        router.push(`/verify-otp?mobile=${registerMobile}&email=${email}`);
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <motion.div {...fadeIn} className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg">
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-28 h-28 rounded-full mb-4"
          >
            <Image
              src="/logo/logo.png"
              alt="HansariaConnect Logo"
              width={70}
              height={70}
              className="rounded-full"
            />
          </motion.div>

          <h1 className="text-3xl font-bold text-gray-800 mb-2">HansariaConnect</h1>
          <p className="text-gray-600">Connect with your world</p>
        </div>
        <div className="flex mb-8 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              mode === "login" 
                ? "bg-white shadow-md text-emerald-600" 
                : "text-gray-500"
            }`}
          >
            Login
          </button>
          <button
            onClick={() => { setMode("scan"); setError(""); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              mode === "scan" 
                ? "bg-white shadow-md text-emerald-600" 
                : "text-gray-500"
            }`}
          >
            Scan to Login
          </button>
          <button
            onClick={() => { setMode("register"); setError(""); }}
            className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
              mode === "register" 
                ? "bg-white shadow-md text-emerald-600" 
                : "text-gray-500"
            }`}
          >
            Register
          </button>
        </div>

        {mode === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              {loading ? "Sending OTP..." : "Continue"}
            </motion.button>
          </form>
        ) : mode === "scan" ? (
          <div className="space-y-6 text-center">
            <div className="p-6 bg-gray-50 rounded-2xl">
              {scanLoading || !scanToken ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <RefreshCw className="w-12 h-12 text-gray-400 animate-spin" />
                  <p className="mt-4 text-gray-500">Generating QR code...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <QRCode
                    value={`hansaria://scan?token=${scanToken}`}
                    size={256}
                    level="H"
                  />
                  <p className="mt-4 text-gray-600">Scan this QR code from your logged-in HansariaConnect app</p>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                generateScanToken();
              }}
              className="flex items-center justify-center gap-2 w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh QR Code
            </button>
          </div>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setError(""); }}
                  placeholder="Enter your name"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="Enter your email"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  maxLength={10}
                  value={registerMobile}
                  onChange={(e) => { setRegisterMobile(e.target.value); setError(""); }}
                  placeholder="Enter 10-digit mobile number"
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Sex</label>
              <div className="flex gap-4">
                {["male", "female", "other"].map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="sex"
                      value={s}
                      checked={sex === s}
                      onChange={() => { setSex(s as any); setError(""); }}
                      className="w-4 h-4 text-emerald-600"
                    />
                    <span className="text-gray-700 capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date of Birth</label>
              <div className="relative">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => { setDob(e.target.value); setError(""); }}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => { setTerms(e.target.checked); setError(""); }}
                  className="w-5 h-5 text-emerald-600"
                />
                <span className="text-gray-700">
                  I accept the{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/terms")}
                    className="text-emerald-600 font-semibold hover:underline"
                  >
                    Terms and Conditions
                  </button>
                </span>
              </label>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              {loading ? "Registering..." : "Register"}
            </motion.button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

export default Login;
