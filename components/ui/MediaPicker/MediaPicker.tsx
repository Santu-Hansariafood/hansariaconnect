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
} from "lucide-react"
import React, { useState, useRef } from "react"

interface MediaPickerProps {
  onSelect: (file: File | { url: string }, type: string) => void
  onClose: () => void
}

const MediaPicker: React.FC<MediaPickerProps> = ({ onSelect, onClose }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const recordingInterval = useRef<NodeJS.Timeout | null>(null)
  
  const handleFileSelect = (type: string, accept: string) => {
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

  const determineFileType = (file: File): string => {
    const type = file.type
    if (type.startsWith("image/")) return "image"
    if (type.startsWith("video/")) return "video"
    if (type === "application/pdf") return "pdf"
    if (type.includes("excel") || type.includes("spreadsheet")) return "excel"
    return "file"
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="absolute bottom-20 left-4 bg-white rounded-2xl shadow-2xl p-4 border border-gray-200 z-50"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Share Media</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFileSelect("image", "image/*")}
            className="flex flex-col items-center gap-2 p-4 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
          >
            <ImageIcon className="w-8 h-8 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-700">Image</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFileSelect("video", "video/*")}
            className="flex flex-col items-center gap-2 p-4 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors"
          >
            <Video className="w-8 h-8 text-blue-600" />
            <span className="text-sm font-medium text-blue-700">Video</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-colors ${
              isRecording
                ? "bg-red-50 hover:bg-red-100"
                : "bg-purple-50 hover:bg-purple-100"
            }`}
          >
            <Mic
              className={`w-8 h-8 ${
                isRecording ? "text-red-600 animate-pulse" : "text-purple-600"
              }`}
            />
            <span
              className={`text-sm font-medium ${
                isRecording ? "text-red-700" : "text-purple-700"
              }`}
            >
              {isRecording ? `${recordingTime}s` : "Voice"}
            </span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
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
              }
              input.click()
            }}
            className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <Paperclip className="w-8 h-8 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">File</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleFileSelect("pdf", "application/pdf")}
            className="flex flex-col items-center gap-2 p-4 bg-orange-50 hover:bg-orange-100 rounded-xl transition-colors"
          >
            <FileText className="w-8 h-8 text-orange-600" />
            <span className="text-sm font-medium text-orange-700">PDF</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              handleFileSelect(
                "excel",
                "application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              )
            }
            className="flex flex-col items-center gap-2 p-4 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
          >
            <FileIcon className="w-8 h-8 text-green-600" />
            <span className="text-sm font-medium text-green-700">Excel</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLinkShare}
            className="flex flex-col items-center gap-2 p-4 bg-cyan-50 hover:bg-cyan-100 rounded-xl transition-colors"
          >
            <LinkIcon className="w-8 h-8 text-cyan-600" />
            <span className="text-sm font-medium text-cyan-700">Link</span>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

export default MediaPicker
