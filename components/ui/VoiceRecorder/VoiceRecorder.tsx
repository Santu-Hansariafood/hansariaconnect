"use client";

import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Send, Trash2 } from "lucide-react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number) => void;
  onCancel?: () => void;
  theme?: { primary?: string };
}

export default function VoiceRecorder({
  onRecordingComplete,
  onCancel,
  theme,
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        onRecordingComplete(blob, recordingTime);
        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
      setIsRecording(false);
      setRecordingTime(0);
      onCancel?.();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (!isRecording) {
    return (
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={startRecording}
        className="rounded-full p-2.5 text-[#54656f] transition-all duration-200 hover:bg-[#e5e7eb]"
        title="Record voice message"
      >
        <Mic className="h-5 w-5" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex items-center gap-2 bg-red-50 rounded-full px-4 py-2.5 border border-red-200"
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ repeat: Infinity, duration: 1 }}
        className="w-3 h-3 bg-red-500 rounded-full"
      />

      <span className="text-sm font-medium text-red-600 flex-1">
        Recording: {formatTime(recordingTime)}
      </span>

      <div className="flex gap-2">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={cancelRecording}
          className="p-1.5 hover:bg-red-200 rounded-full transition-colors"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4 text-red-600" />
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={stopRecording}
          className="p-1.5 bg-red-500 hover:bg-red-600 rounded-full transition-colors text-white"
          title="Stop and send"
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
}
