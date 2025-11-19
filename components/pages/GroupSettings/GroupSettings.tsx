"use client";

import { useState, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  Edit2,
  UserPlus,
  UserMinus,
  Shield,
} from "lucide-react";
import { groups, contacts } from "@/data/mockData";
import { fadeIn } from "@/utils/animations/animations";
type Theme = {
  wallpaper: string;
  primary: string;
  textSize?: string;
};

type User = {
  name: string;
  mobile: string;
  avatar?: string;
};

type Group = {
  id: number;
  name: string;
  avatar: string;
  admin: string;
  members: string[];
};

const GroupSettings = ({ user, theme }: { user: User; theme: Theme }) => {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const group = groups.find((g) => g.id === parseInt(id));
  const [groupData, setGroupData] = useState<Group | undefined>(group);
  const [isEditing, setIsEditing] = useState(false);

  if (!groupData) return null;

  const isAdmin = groupData.admin === user.mobile;
  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupData((prev) =>
          prev ? { ...prev, avatar: reader.result as string } : prev
        );
      };
      reader.readAsDataURL(file);
    }
  };
  const handleRemoveMember = (memberId: string) => {
    if (!isAdmin || !groupData) return;
    setGroupData({
      ...groupData,
      members: groupData.members.filter((m) => m !== memberId),
    });
  };
  const handleMakeAdmin = (memberId: string) => {
    if (!isAdmin || !groupData) return;
    setGroupData({ ...groupData, admin: memberId });
  };

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white border-b border-gray-200 px-4 py-4 shadow-sm"
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push("/groups")}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" style={{ color: theme.primary }} />
          </button>
          <h1
            className={`text-2xl font-bold text-gray-800 ${theme.textSize || ""}`}
          >
            Group Settings
          </h1>
        </div>
      </motion.header>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center gap-6 mb-6">
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="w-24 h-24 rounded-full overflow-hidden border-4 shadow-lg"
                style={{ borderColor: theme.primary }}
              >
                <img
                  src={groupData.avatar}
                  alt="Group"
                  className="w-full h-full object-cover"
                />
              </motion.div>

              {isAdmin && (
                <label
                  className="absolute bottom-0 right-0 p-2 rounded-full cursor-pointer shadow-lg"
                  style={{ backgroundColor: theme.primary }}
                >
                  <Camera className="w-4 h-4 text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="flex-1">
              {isEditing && isAdmin ? (
                <input
                  type="text"
                  value={groupData.name}
                  onChange={(e) =>
                    setGroupData({ ...groupData, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-lg font-semibold"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-800">
                  {groupData.name}
                </h2>
              )}
              <p className="text-gray-600 mt-1">
                {groupData.members.length} members
              </p>
            </div>
            {isAdmin && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsEditing(!isEditing)}
                className="p-3 rounded-full"
                style={{ backgroundColor: theme.primary }}
              >
                <Edit2 className="w-5 h-5 text-white" />
              </motion.button>
            )}
          </div>
        </motion.div>
        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Members</h3>
          <div className="space-y-3">
            {groupData.members.map((memberId) => {
              const member = contacts.find((c) => c.mobile === memberId);
              if (!member) return null;
              const isMemberAdmin = groupData.admin === memberId;

              return (
                <motion.div
                  key={memberId}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                >
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{member.name}</p>
                    <p className="text-sm text-gray-500">{member.mobile}</p>
                  </div>

                  {isMemberAdmin && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium">
                      <Shield className="w-4 h-4" />
                      Admin
                    </div>
                  )}

                  {isAdmin && !isMemberAdmin && (
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleMakeAdmin(memberId)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                        title="Make Admin"
                      >
                        <Shield className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleRemoveMember(memberId)}
                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                        title="Remove Member"
                      >
                        <UserMinus className="w-4 h-4" />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {isAdmin && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: theme.primary }}
            >
              <UserPlus className="w-5 h-5" />
              Add Members
            </motion.button>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default GroupSettings;
