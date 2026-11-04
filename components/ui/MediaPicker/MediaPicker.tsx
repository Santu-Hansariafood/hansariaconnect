"use client"

import { motion, AnimatePresence } from "framer-motion"
import {
  Image as ImageIcon,
  Video,
  X,
  Mic,
  FileText,
  Link as LinkIcon,
  File as FileIcon,
  Paperclip,
  Camera,
  MapPin,
  UserRound,
} from "lucide-react"
import React, { useState, useRef } from "react"
import { MessageType } from "@/components/pages/ChatWindow/ChatWindowTypes"

interface MediaPickerProps {
  onSelect: (file: File | { url: string }, type: MessageType) => void
  onClose: () => void
}

const MediaPicker: React.FC<MediaPickerProps> = ({ onSelect, onClose }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)
  
  const handleFileSelect = (type: MessageType, accept: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]
      if (file) onSelect(file, type)
    }
    input.click()
  }
  
  const startRecording = async () => {
    if (!navigator.mediaDevices) {
      alert("Microphone not supported in this browser.")
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      recorder.ondataavailable = (e: BlobEvent) => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" })
        const file = new File([blob], "voice-message.webm", { type: "audio/webm" })
        onSelect(file, "voice")
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingTime(0)

      recordingInterval.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error("Microphone error:", error)
      alert("Unable to access microphone. Please check permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      setIsRecording(false)
      if (recordingInterval.current) clearInterval(recordingInterval.current)
      setRecordingTime(0)
    }
  }

  const handleLinkShare = () => {
    const url = prompt("Enter link URL:")
    if (url) onSelect({ url }, "link")
  }

  const determineFileType = (file: File): MessageType => {
    const type = file.type
    if (type.startsWith("image/")) return "image"
    if (type.startsWith("video/")) return "video"
    if (type === "application/pdf") return "pdf"
    if (type.includes("excel") || type.includes("spreadsheet")) return "excel"
    return "file"
  }

  const handleCameraPick = () => {
    handleFileSelect("image", "image/*")
  }

  const handleContactShare = () => {
    const contactText = window.prompt("Enter contact name and number:")
    if (!contactText || !contactText.trim()) return
    onSelect({ url: `Contact: ${contactText.trim()}` }, "link")
    onClose()
  }

  const handleLocationShare = () => {
    if (!navigator.geolocation) {
      window.alert("Geolocation is not supported by this browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const mapUrl = `https://maps.google.com/?q=${latitude},${longitude}`
        onSelect({ url: mapUrl }, "link")
        onClose()
      },
      () => {
        window.alert("Location access was denied.")
      },
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-20 left-0 z-50 w-[320px] rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-2xl sm:left-2"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 dark:text-slate-100">Share</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 transition-colors hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4 text-gray-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFileSelect("image", "image/*")}
            className="flex flex-col items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 p-4 text-emerald-700 dark:text-emerald-300 transition-colors hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
          >
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm font-medium">Photos</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCameraPick}
            className="flex flex-col items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 p-4 text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-900/50"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm font-medium">Camera</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              input.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement
                const file = target.files?.[0]
                if (file) {
                  const type = determineFileType(file)
                  onSelect(file, type)
                }
                onClose()
              }
              input.click()
            }}
            className="flex flex-col items-center gap-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 p-4 text-orange-700 dark:text-orange-300 transition-colors hover:bg-orange-100 dark:hover:bg-orange-900/50"
          >
            <FileText className="h-8 w-8" />
            <span className="text-sm font-medium">Documents</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleContactShare}
            className="flex flex-col items-center gap-2 rounded-xl bg-violet-50 dark:bg-violet-900/30 p-4 text-violet-700 dark:text-violet-300 transition-colors hover:bg-violet-100 dark:hover:bg-violet-900/50"
          >
            <UserRound className="h-8 w-8" />
            <span className="text-sm font-medium">Contact</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLocationShare}
            className="flex flex-col items-center gap-2 rounded-xl bg-pink-50 dark:bg-pink-900/30 p-4 text-pink-700 dark:text-pink-300 transition-colors hover:bg-pink-100 dark:hover:bg-pink-900/50"
          >
            <MapPin className="h-8 w-8" />
            <span className="text-sm font-medium">Location</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLinkShare}
            className="flex flex-col items-center gap-2 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 p-4 text-cyan-700 dark:text-cyan-300 transition-colors hover:bg-cyan-100 dark:hover:bg-cyan-900/50"
          >
            <LinkIcon className="h-8 w-8" />
            <span className="text-sm font-medium">Link</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex flex-col items-center gap-2 rounded-xl p-4 transition-colors ${
              isRecording
                ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/50"
                : "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
            }`}
          >
            <Mic
              className={`h-8 w-8 ${
                isRecording ? "animate-pulse" : ""
              }`}
            />
            <span className="text-sm font-medium">
              {isRecording ? `${recordingTime}s` : "Voice"}
            </span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const input = document.createElement("input")
              input.type = "file"
              input.onchange = (e: Event) => {
                const target = e.target as HTMLInputElement
                const file = target.files?.[0]
                if (file) {
                  const type = determineFileType(file)
                  onSelect(file, type)
                }
                onClose()
              }
              input.click()
            }}
            className="flex flex-col items-center gap-2 rounded-xl bg-gray-100 dark:bg-slate-800 p-4 text-gray-700 dark:text-slate-200 transition-colors hover:bg-gray-200 dark:hover:bg-slate-700"
          >
            <Paperclip className="h-8 w-8" />
            <span className="text-sm font-medium">File</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFileSelect("video", "video/*")}
            className="flex flex-col items-center gap-2 rounded-xl bg-sky-50 dark:bg-sky-900/30 p-4 text-sky-700 dark:text-sky-300 transition-colors hover:bg-sky-100 dark:hover:bg-sky-900/50"
          >
            <Video className="h-8 w-8" />
            <span className="text-sm font-medium">Video</span>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default MediaPicker
