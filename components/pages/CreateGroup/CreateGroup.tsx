"use client";

import { useState, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Plus, X } from "lucide-react";
import { contacts } from "@/data/mockData";
import { fadeIn } from "@/utils/animations/animations";

type Contact = {
  id: number;
  name: string;
  mobile: string;
  avatar: string;
};

type Theme = {
  primary: string;
  textSize?: string;
  wallpaper?: string;
};

type CreateGroupProps = {
  user: any;
  theme: Theme;
};

const CreateGroup: React.FC<CreateGroupProps> = ({ user, theme }) => {
  const router = useRouter();
  const [groupName, setGroupName] = useState("");
  const [groupPhoto, setGroupPhoto] = useState(
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400&h=400&fit=crop"
  );
  const [selectedMembers, setSelectedMembers] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const handlePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMember = (contact: Contact) => {
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === contact.id)
        ? prev.filter((m) => m.id !== contact.id)
        : [...prev, contact]
    );
  };

  const handleCreate = () => {
    if (groupName.trim() && selectedMembers.length > 0) {
      router.push("/groups");
    }
  };

  const filteredContacts = contacts.filter(
    (contact: Contact) =>
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.mobile.includes(searchQuery)
  );

  return (
    <div className={`min-h-screen ${theme.wallpaper || ""}`}>
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
            className={`text-2xl font-bold text-gray-800 ${
              theme.textSize || ""
            }`}
          >
            Create Group
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
                  src={groupPhoto}
                  alt="Group"
                  className="w-full h-full object-cover"
                />
              </motion.div>
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
            </div>
            <div className="flex-1">
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Group Name"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-lg font-semibold"
              />
            </div>
          </div>
          {selectedMembers.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Selected Members ({selectedMembers.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {member.name}
                    <button
                      onClick={() => toggleMember(member)}
                      className="hover:bg-white/20 rounded-full p-1 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
        <motion.div {...fadeIn} className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="w-full px-4 py-3 bg-gray-100 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
            {filteredContacts.map((contact: Contact) => {
              const isSelected = selectedMembers.some(
                (m) => m.id === contact.id
              );
              return (
                <motion.button
                  key={contact.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => toggleMember(contact)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                    isSelected ? "bg-emerald-50" : "hover:bg-gray-50"
                  }`}
                >
                  <img
                    src={contact.avatar}
                    alt={contact.name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-gray-800">
                      {contact.name}
                    </p>
                    <p className="text-sm text-gray-500">{contact.mobile}</p>
                  </div>
                  {isSelected && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: theme.primary }}
                    >
                      <Plus className="w-4 h-4 text-white rotate-45" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
        <motion.button
          {...fadeIn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          disabled={!groupName.trim() || selectedMembers.length === 0}
          className="w-full mt-6 py-4 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.primary }}
        >
          Create Group with {selectedMembers.length} member
          {selectedMembers.length !== 1 ? "s" : ""}
        </motion.button>
      </div>
    </div>
  );
};

export default CreateGroup;
