"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, RotateCcw } from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";

type OtpProps = {
  onVerify: (code: string) => void;
  onResend?: () => void;
  mobile: string;
  serverError?: string;
};

const Otp: React.FC<OtpProps> = ({ onVerify, onResend, mobile, serverError }) => {
  const [code, setCode] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (/^\d{6}$/.test(code)) {
      onVerify(code);
    } else {
      setError("Enter the 6-digit code sent to your phone");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <motion.div {...fadeIn} className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.5, delay: 0.2 }} className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full mb-4">
            <ShieldCheck className="w-10 h-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify OTP</h2>
          <p className="text-gray-600">Sent to {mobile}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter 6-digit code</label>
            <input
              type="tel"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              placeholder="XXXXXX"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none tracking-widest text-center text-lg"
              maxLength={6}
            />
            {(error || serverError) && (
              <motion.p initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-red-500 text-sm mt-2">
                {serverError || error}
              </motion.p>
            )}
          </div>

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow">
            Verify
          </motion.button>
        </form>

        {/* <div className="mt-6 text-center">
          <button onClick={onResend} className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
            <RotateCcw className="w-4 h-4" />
            Resend OTP
          </button>
        </div> */}
      </motion.div>
    </div>
  );
};

export default Otp;
