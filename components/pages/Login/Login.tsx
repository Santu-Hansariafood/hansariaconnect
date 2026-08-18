"use client";

import { useState, FormEvent, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Phone,
  User,
  Mail,
  Calendar,
  Check,
  X,
  QrCode,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";
import Image from "next/image";
import QRCode from "react-qr-code";
import Loading from "@/components/common/Loading/Loading";

type LoginProps = {
  prefillMobile?: string;
  reason?: string;
};

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;
const ALLOWED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)$/i;

const Login = ({ prefillMobile, reason }: LoginProps) => {
  const router = useRouter();
  const [host, setHost] = useState("");
  const [isWebSubdomain, setIsWebSubdomain] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mobile, setMobile] = useState(prefillMobile || "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registerMobile, setRegisterMobile] = useState(prefillMobile || "");
  const [sex, setSex] = useState<"male" | "female" | "other" | "">("");
  const [dob, setDob] = useState("");
  const [terms, setTerms] = useState(false);
  const [infoBanner, setInfoBanner] = useState(
    reason === "not-registered"
      ? "You don't have an account yet. Please create one below."
      : "",
  );

  const [scanToken, setScanToken] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    const currentHost = window.location.host;
    setHost(currentHost);
    setIsWebSubdomain(/^web\./i.test(currentHost));
  }, []);

  useEffect(() => {
    if (prefillMobile) {
      setMobile(prefillMobile);
      setRegisterMobile(prefillMobile);
    }
    if (reason === "not-registered") {
      setMode("register");
      setInfoBanner("You don't have an account yet. Please create one below.");
    }
  }, [prefillMobile, reason]);

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
    if (isWebSubdomain) {
      generateScanToken();
    }
  }, [isWebSubdomain]);

  useEffect(() => {
    if (!scanToken || !isWebSubdomain) return;

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
  }, [scanToken, isWebSubdomain, router]);

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!INDIAN_MOBILE_REGEX.test(mobile)) {
      setError("Please enter a valid Indian mobile number");
      return;
    }

    setLoading(true);
    setError("");
    setInfoBanner("");

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
        const queryEmail = data.email
          ? `&email=${encodeURIComponent(data.email)}`
          : "";
        router.push(`/verify-otp?mobile=${mobile}${queryEmail}`);
      } else {
        if (data.notRegistered) {
          setError("");
          setInfoBanner(
            "You don't have an account yet. Please create one below.",
          );
          setRegisterMobile(mobile);
          setMode("register");
        } else {
          setError(data.error || "Something went wrong");
        }
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
      setError(
        "Please fill all required fields and accept terms and conditions",
      );
      return;
    }

    if (!INDIAN_MOBILE_REGEX.test(registerMobile)) {
      setError("Please enter a valid Indian mobile number");
      return;
    }

    if (!ALLOWED_EMAIL_REGEX.test(email.trim().toLowerCase())) {
      setError(
        "Only Gmail, Outlook, and Hansaria Food email addresses are allowed",
      );
      return;
    }

    setLoading(true);
    setError("");
    setInfoBanner("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          email,
          mobile: registerMobile,
          sex,
          dateOfBirth: dob,
          termsAccepted: terms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devOtp) console.log("OTP:", data.devOtp);
        router.push(
          `/verify-otp?mobile=${registerMobile}&email=${encodeURIComponent(email)}`,
        );
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (isWebSubdomain) {
    return (
      <Suspense fallback={<Loading />}>
        <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
          <motion.div
            {...fadeIn}
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg"
          >
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
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                HansariaConnect Web
              </h1>
              <p className="text-gray-600">
                Scan to login with your mobile app
              </p>
            </div>
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
                    <p className="mt-4 text-gray-600">
                      Scan this QR code from your logged-in HansariaConnect app
                    </p>
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
          </motion.div>
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <motion.div
          {...fadeIn}
          className="bg-white rounded-3xl shadow-2xl p-4 md:p-6 w-full max-w-6xl overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.9fr] gap-6">
            <div className="hidden lg:flex flex-col justify-center rounded-3xl bg-gradient-to-br from-emerald-600 to-cyan-500 p-10 text-white">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-14 h-14 rounded-3xl bg-white/15 flex items-center justify-center shadow-lg">
                  <Image
                    src="/logo/logo.png"
                    alt="HansariaConnect Logo"
                    width={44}
                    height={44}
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-white/80">
                    HansariaConnect
                  </p>
                  <h2 className="text-3xl font-semibold">
                    Secure chat across devices
                  </h2>
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-3xl bg-white/10 p-5 border border-white/20">
                  <h3 className="text-lg font-semibold">Simple login</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Use your mobile number to authenticate with OTP.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-5 border border-white/20">
                  <h3 className="text-lg font-semibold">Professional layout</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Clean, responsive design inspired by modern messaging apps.
                  </p>
                </div>
                <div className="rounded-3xl bg-white/10 p-5 border border-white/20">
                  <h3 className="text-lg font-semibold">Email OTP</h3>
                  <p className="mt-2 text-sm text-white/80">
                    Your code is delivered securely to the email you provide.
                  </p>
                </div>
              </div>
            </div>

            <div className="py-6 px-5 sm:px-8">
              <div className="text-center mb-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4 bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg"
                >
                  <Image
                    src="/logo/logo.png"
                    alt="HansariaConnect Logo"
                    width={56}
                    height={56}
                    className="rounded-full"
                  />
                </motion.div>

                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  HansariaConnect
                </h1>
                <p className="text-gray-600">
                  Fast, secure messaging with email OTP login.
                </p>
              </div>

              {mode === "login" ? (
                <div className="space-y-6">
                  <form onSubmit={handleLoginSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Number
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="tel"
                          maxLength={10}
                          value={mobile}
                          onChange={(e) => {
                            setMobile(e.target.value);
                            setError("");
                            setInfoBanner("");
                          }}
                          placeholder="Enter 10-digit mobile number"
                          className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                        />
                      </div>
                      {error && (
                        <p className="text-red-500 text-sm mt-2">{error}</p>
                      )}
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

                  <div className="text-center">
                    <p className="text-gray-600">
                      New to HansariaConnect?{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setMode("register");
                          setError("");
                          setInfoBanner("");
                          setRegisterMobile(mobile);
                        }}
                        className="text-emerald-600 font-semibold hover:underline"
                      >
                        Create Account
                      </button>
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError("");
                      setInfoBanner("");
                    }}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-4"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </button>

                  {infoBanner && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                    >
                      <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-800">{infoBanner}</p>
                    </motion.div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setError("");
                        }}
                        placeholder="Enter your name"
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setError("");
                        }}
                        placeholder="Enter your email (OTP will be sent here)"
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Allowed: gmail.com, outlook.com, hansariafood.com
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        maxLength={10}
                        value={registerMobile}
                        onChange={(e) => {
                          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setRegisterMobile(digits);
                          setError("");
                        }}
                        placeholder="Enter Indian mobile number"
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Use a valid 10-digit Indian mobile number starting with 6 to 9
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sex
                    </label>
                    <div className="flex gap-4">
                      {["male", "female", "other"].map((s) => (
                        <label
                          key={s}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="sex"
                            value={s}
                            checked={sex === s}
                            onChange={() => {
                              setSex(s as any);
                              setError("");
                            }}
                            className="w-4 h-4 text-emerald-600"
                          />
                          <span className="text-gray-700 capitalize">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Birth
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => {
                          setDob(e.target.value);
                          setError("");
                        }}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={terms}
                        onChange={(e) => {
                          setTerms(e.target.checked);
                          setError("");
                        }}
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
                    {loading ? "Registering..." : "Create Account"}
                  </motion.button>
                </form>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </Suspense>
  );
};

export default Login;
