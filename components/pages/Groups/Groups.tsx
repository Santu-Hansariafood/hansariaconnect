"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { groups } from "@/data/mockData";
import { staggerContainer, fadeIn } from "@/utils/animations/animations";
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

const Groups: React.FC<GroupsProps> = ({ user, theme }) => {
  const router = useRouter();

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

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {groups.map((group) => (
            <motion.div key={group.id} variants={fadeIn}>
              <GroupCard
                group={group}
                user={user}
                theme={theme}
                onClick={() => router.push(`/chat/${group.id}`)}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default Groups;
