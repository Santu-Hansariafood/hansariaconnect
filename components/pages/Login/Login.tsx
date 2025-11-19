"use client";

import { useState, FormEvent } from "react";
import { motion } from "framer-motion";
import { Phone, MessageCircle } from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";

type LoginProps = {
  onLogin: (mobile: string) => void;
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [mobile, setMobile] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (/^\d{10}$/.test(mobile)) {
      onLogin(mobile);
    } else {
      setError("Please enter a valid 10-digit mobile number");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <motion.div
        {...fadeIn}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full mb-4"
          >
            <MessageCircle className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">HansariaConnect</h1>
          <p className="text-gray-600">Connect with your world</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mobile Number
            </label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={mobile}
                onChange={(e) => {
                  setMobile(e.target.value);
                  setError("");
                }}
                placeholder="Enter 10-digit mobile number"
                className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors"
                maxLength={10}
              />
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm mt-2"
              >
                {error}
              </motion.p>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            Continue
          </motion.button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
