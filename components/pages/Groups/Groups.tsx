"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { staggerContainer, fadeInVariants } from "@/utils/animations/animations";
import dynamic from "next/dynamic";
const Navbar = dynamic(() => import("@/components/common/Navbar/Navbar"));
const GroupCard = dynamic(() => import("@/components/ui/GroupCard/GroupCard"));

type Theme = {
  wallpaper: string;
  primary: string;
  textSize?: string;
};

type User = {
  id: string;
  name: string;
  avatar?: string;
};

type GroupsProps = {
  user: User;
  theme: Theme;
};

type GroupSummary = {
  id: string;
  name: string;
  avatar: string;
  members: string[];
  admin: string;
  lastMessage?: string;
  lastMessageTime?: string;
};

const Groups: React.FC<GroupsProps> = ({ user, theme }) => {
  const router = useRouter();
  const [groupList, setGroupList] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const loadGroups = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/groups", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load groups");
      }
      setGroupList(Array.isArray(data?.groups) ? data.groups : []);
    } catch (err: any) {
      setGroupList([]);
      setError(err?.message || "Unable to load groups right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  return (
    <div className={`min-h-screen ${theme.wallpaper}`}>
      <Navbar user={user} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center justify-between"
        >
          <h1
            className={`text-3xl font-bold text-gray-800 ${theme.textSize || ""}`}
          >
            Groups
          </h1>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push("/create-group")}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-xl shadow-lg font-semibold"
            style={{ backgroundColor: theme.primary }}
          >
            <Plus className="w-5 h-5" />
            Create Group
          </motion.button>
        </motion.div>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {loading ? (
          <div className="py-12 text-center text-gray-500">Loading your groups...</div>
        ) : groupList.length ? (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {groupList.map((group) => (
              <motion.div key={group.id} variants={fadeInVariants}>
                <GroupCard
                  group={group}
                  user={{ mobile: (user as any)?.mobile || "" } as any}
                  theme={theme}
                  onClick={() => router.push(`/chat/${group.id}`)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="py-12 text-center text-gray-500">
            No groups yet. Create one to start collaborating.
          </div>
        )}
      </div>
    </div>
  );
};

export default Groups;
