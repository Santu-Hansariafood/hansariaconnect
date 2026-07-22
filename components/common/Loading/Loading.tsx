"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-lime-100 overflow-hidden">
      {/* Background Blur */}
      <motion.div
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.15, 0.3, 0.15],
        }}
        transition={{
          repeat: Infinity,
          duration: 4,
        }}
        className="absolute w-96 h-96 rounded-full bg-green-300 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center">

        {/* Logo */}
        <motion.div
          animate={{
            y: [0, -8, 0],
            scale: [1, 1.05, 1],
          }}
          transition={{
            repeat: Infinity,
            duration: 2,
          }}
          className="relative"
        >
          <Image
            src="/images/hansaria-connect-logo.png"
            alt="Hansaria Food Connect"
            width={130}
            height={130}
            priority
          />
        </motion.div>

        {/* App Name */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: .2 }}
          className="mt-6 text-3xl font-bold text-green-700"
        >
          Hansaria Food Connect
        </motion.h1>

        <p className="mt-2 text-gray-500">
          Connecting Farmers, Buyers & Businesses
        </p>

        {/* Messenger Typing */}
        <div className="flex gap-2 mt-8">
          {[0, 1, 2].map((item) => (
            <motion.div
              key={item}
              animate={{
                y: [0, -8, 0],
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                repeat: Infinity,
                duration: 0.8,
                delay: item * 0.2,
              }}
              className="w-3 h-3 rounded-full bg-green-600"
            />
          ))}
        </div>

        {/* Progress Bar */}
        <div className="mt-8 w-72 h-2 rounded-full bg-green-100 overflow-hidden">
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{
              repeat: Infinity,
              duration: 1.8,
              ease: "linear",
            }}
            className="h-full w-1/2 bg-gradient-to-r from-green-500 to-lime-400"
          />
        </div>

        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            repeat: Infinity,
            duration: 1.5,
          }}
          className="mt-6 text-gray-600 font-medium"
        >
          Preparing your conversations...
        </motion.p>

      </div>
    </div>
  );
}