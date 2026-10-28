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
import dynamic from "next/dynamic";
import Loading from "@/components/common/Loading/Loading";
import { normalizeIndianMobile } from "@/lib/auth/normalizeIndianMobile";
import {
  isValidPersonName,
  normalizeEmailInput,
  normalizeIndianMobileInput,
  normalizeNameInput,
} from "@/utils/validation/formInputs";

// Only needed once the QR sign-in panel is opened, so it is kept out of the
// login page's initial download.
const QRCode = dynamic(() => import("react-qr-code"), { ssr: false });

type LoginProps = {
  prefillMobile?: string;
  reason?: string;
  returnTo?: string;
};

const ALLOWED_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)$/i;

const Login = ({ prefillMobile, reason, returnTo }: LoginProps) => {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mobile, setMobile] = useState(() =>
    normalizeIndianMobileInput(prefillMobile || ""),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registerMobile, setRegisterMobile] = useState(() =>
    normalizeIndianMobileInput(prefillMobile || ""),
  );
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
  const [showQrLogin, setShowQrLogin] = useState(false);

  useEffect(() => {
    if (prefillMobile) {
      const normalizedMobile = normalizeIndianMobileInput(prefillMobile);
      setMobile(normalizedMobile);
      setRegisterMobile(normalizedMobile);
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
        setError("");
      } else {
        setError(data.error || "Could not generate a login QR code.");
      }
    } catch (err) {
      console.error(err);
      setError("Could not generate a login QR code. Please try again.");
    } finally {
      setScanLoading(false);
    }
  };

  useEffect(() => {
    if (!scanToken || !showQrLogin) return;

    let finished = false;
    let verifying = false;
    const pollInterval = setInterval(async () => {
      if (finished || verifying) return;
      try {
        const res = await fetch(`/api/auth/scan/generate?token=${scanToken}`);
        const data = await res.json();

        if (res.status === 404 || res.status === 403) {
          finished = true;
          setError(data.error || "This QR code expired. Refresh it to try again.");
          return;
        }

        if (data.success && data.ready) {
          verifying = true;
          const verifyRes = await fetch("/api/auth/scan/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: scanToken }),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            finished = true;
            const userData = {
              id: verifyData.userId as string,
              mobile: verifyData.mobile as string,
              name: verifyData.name || undefined,
              photo: verifyData.photo || undefined,
              email: verifyData.email || undefined,
              step: "complete" as const,
            };
            localStorage.setItem("hansariaUser", JSON.stringify(userData));
            window.location.assign("/chat");
          } else {
            finished = true;
            setError(verifyData.error || "Could not complete the linked login.");
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [scanToken, showQrLogin, router]);

  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedMobile = normalizeIndianMobile(mobile);
    if (!normalizedMobile) {
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
        body: JSON.stringify({ mobile: normalizedMobile }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devOtp) console.log("OTP:", data.devOtp);
        const queryEmail = data.email
          ? `&email=${encodeURIComponent(data.email)}`
          : "";
        const queryReturnTo = returnTo
          ? `&returnTo=${encodeURIComponent(returnTo)}`
          : "";
        router.push(
          `/verify-otp?mobile=${normalizedMobile}${queryEmail}${queryReturnTo}`,
        );
      } else {
        if (data.notRegistered) {
          setError("");
          setInfoBanner(
            "You don't have an account yet. Please create one below.",
          );
          setRegisterMobile(normalizeIndianMobileInput(mobile));
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

    const normalizedName = normalizeNameInput(name).trim();
    const normalizedEmail = normalizeEmailInput(email);
    if (!normalizedName || !normalizedEmail || !registerMobile || !sex || !dob || !terms) {
      setError(
        "Please fill all required fields and accept terms and conditions",
      );
      return;
    }

    if (!isValidPersonName(normalizedName)) {
      setError("Enter a name using letters, spaces, apostrophes, or hyphens.");
      return;
    }

    const normalizedMobile = normalizeIndianMobileInput(registerMobile);
    if (!normalizedMobile) {
      setError("Please enter a valid Indian mobile number");
      return;
    }

    if (!ALLOWED_EMAIL_REGEX.test(normalizedEmail)) {
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
          name: normalizedName,
          email: normalizedEmail,
          mobile: normalizedMobile,
          sex,
          dateOfBirth: dob,
          termsAccepted: terms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.devOtp) console.log("OTP:", data.devOtp);
        const queryReturnTo = returnTo
          ? `&returnTo=${encodeURIComponent(returnTo)}`
          : "";
        router.push(
          `/verify-otp?mobile=${normalizedMobile}&email=${encodeURIComponent(normalizedEmail)}${queryReturnTo}`,
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

              <div className="mb-5 text-center">
                <button
                  type="button"
                  onClick={() => {
                    const shouldShowQrLogin = !showQrLogin;
                    setShowQrLogin(shouldShowQrLogin);
                    setError("");
                    if (shouldShowQrLogin) {
                      void generateScanToken();
                    }
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  aria-expanded={showQrLogin}
                >
                  <QrCode className="h-4 w-4" aria-hidden="true" />
                  {showQrLogin ? "Hide QR login" : "Scan to login with mobile"}
                </button>
                {showQrLogin && (
                  <div className="mt-4 rounded-2xl bg-gray-50 p-4">
                    {scanLoading || !scanToken ? (
                      <div className="flex flex-col items-center justify-center py-6">
                        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                        <p className="mt-3 text-sm text-gray-500">
                          Generating QR code…
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <QRCode
                          value={(() => {
                            const scanUrl = new URL(window.location.href);
                            scanUrl.pathname = "/scan";
                            scanUrl.search = new URLSearchParams({
                              token: scanToken,
                            }).toString();
                            return scanUrl.toString();
                          })()}
                          size={220}
                          level="H"
                        />
                        <p className="mt-3 text-sm text-gray-600">
                          Scan with your signed-in HansariaConnect mobile app.
                        </p>
                        <button
                          type="button"
                          onClick={() => void generateScanToken()}
                          disabled={scanLoading}
                          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50"
                        >
                          <RefreshCw className="h-4 w-4" />
                          Refresh QR code
                        </button>
                      </div>
                    )}
                    {error && (
                      <p role="alert" className="mt-3 text-sm text-red-600">
                        {error}
                      </p>
                    )}
                  </div>
                )}
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
                          inputMode="numeric"
                          pattern="[6-9][0-9]{9}"
                          autoComplete="tel-national"
                          required
                          value={mobile}
                          onChange={(e) => {
                            setMobile(normalizeIndianMobileInput(e.target.value));
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
                          setName(normalizeNameInput(e.target.value));
                          setError("");
                        }}
                        maxLength={80}
                        autoComplete="name"
                        required
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
                          setEmail(normalizeEmailInput(e.target.value));
                          setError("");
                        }}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        autoComplete="email"
                        pattern="[A-Za-z0-9._%+-]+@(gmail\.com|outlook\.com|hansariafood\.com)"
                        required
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
                        inputMode="numeric"
                        pattern="[6-9][0-9]{9}"
                        autoComplete="tel-national"
                        value={registerMobile}
                        onChange={(e) => {
                          const digits = normalizeIndianMobileInput(e.target.value);
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
