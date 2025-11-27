"use client";

import { useState, ChangeEvent, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Edit2, Save } from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";
import dynamic from "next/dynamic";
import Image from "next/image";

const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"));

type User = {
  id: string;
  name?: string;
  mobile: string;
  photo?: string;
};

type Theme = {
  wallpaper: string;
  primary: string;
  textSize?: string;
};

type ProfileProps = {
  user: User;
  theme: Theme;
};

const Profile: React.FC<ProfileProps> = ({ user, theme }) => {
  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState({
    name: user.name || "User",
    about: "Hey there! I am using HansariaConnect",
    mobile: user.mobile,
    photo: user.photo || "/logo.webp",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user.id) return;
      const res = await fetch(`/api/profile/${user.id}`);
      const data = await res.json();

      if (data?.profile) {
        setProfile({
          name: data.profile.name,
          about: data.profile.about,
          mobile: user.mobile,
          photo: data.profile.photo || "/logo.webp",
        });
      }
    };
    fetchProfile();
  }, [user.id]);
  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd, credentials: "include" });
      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) return;

      const data = await res.json();
      if (data?.url) {
        setProfile((prev) => ({ ...prev, photo: data.url }));
      }
    } catch {}
  };

  const handleSave = async () => {
    try {
      const res = await fetch(`/api/profile/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mobile: user.mobile,
          name: profile.name,
          about: profile.about,
          photo: profile.photo,
          theme,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;

      const data = await res.json();
      if (data?.profile) setIsEditing(false);
    } catch {}
  };

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-2xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <h1
            className={`text-3xl font-bold text-gray-800 ${
              theme.textSize || ""
            }`}
          >
            Profile
          </h1>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg font-semibold"
            style={{ backgroundColor: theme.primary }}
          >
            {isEditing ? <Save className="w-5 h-5" /> : <Edit2 className="w-5 h-5" />}
            {isEditing ? "Save" : "Edit"}
          </motion.button>
        </motion.div>
        <motion.div {...fadeIn} className="bg-white rounded-2xl p-8 shadow-lg">
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="relative w-32 h-32 rounded-full overflow-hidden border-4 shadow-lg"
                style={{ borderColor: theme.primary }}
              >
                <Image
                  src={profile.photo}
                  alt="Profile"
                  fill
                  priority
                  sizes="128px"
                  className="object-cover"
                />
              </motion.div>
              {isEditing && (
                <label
                  className="absolute bottom-0 right-0 p-3 rounded-full cursor-pointer shadow-lg"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Camera className="w-5 h-5 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            {isEditing && (
              <button
                onClick={async () => {
                  await fetch(`/api/profile/${user.id}`, { method: "DELETE" });
                  setProfile({
                    name: "User",
                    about: "Hey there! I am using HansariaConnect",
                    mobile: user.mobile,
                    photo: "/logo.webp",
                  });
                }}
                className="px-4 py-2 text-white rounded-xl"
                style={{ backgroundColor: theme.primary }}
              >
                Delete Profile
              </button>
            )}
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 transition-colors"
                />
              ) : (
                <p className="px-4 py-3 bg-gray-50 rounded-xl">{profile.name}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                About
              </label>
              {isEditing ? (
                <textarea
                  value={profile.about}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, about: e.target.value }))
                  }
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 transition-colors resize-none"
                />
              ) : (
                <p className="px-4 py-3 bg-gray-50 rounded-xl">{profile.about}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mobile Number
              </label>
              <p className="px-4 py-3 bg-gray-50 rounded-xl">
                {profile.mobile}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Mobile number cannot be changed
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
