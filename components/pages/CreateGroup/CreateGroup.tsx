"use client";

import { useState, ChangeEvent, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Camera, Plus, X, ShieldCheck } from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";

type Contact = {
  id: string;
  name: string;
  mobile: string;
  avatar: string;
  registered: boolean;
  registeredUserId?: string;
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
    "/logo/logo.png"
  );
  const [selectedMembers, setSelectedMembers] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const loadContacts = async () => {
      setLoadingContacts(true);
      try {
        const res = await fetch("/api/contacts", { cache: "no-store", credentials: "include" });
        const data = await res.json();
        if (res.ok && Array.isArray(data?.contacts)) {
          const mapped: Contact[] = data.contacts.map((contact: any) => ({
            id: contact._id,
            name: contact.name,
            mobile: contact.mobiles?.[0] || "",
            avatar:
              contact.avatar ||
              "/logo/logo.png",
            registered: !!contact.registered,
            registeredUserId: contact.registeredUserId || "",
          }));
          setContacts(mapped.filter((contact) => contact.mobile));
        } else {
          setError(data?.error || "Failed to load contacts");
        }
      } catch {
        setError("Failed to load contacts");
      } finally {
        setLoadingContacts(false);
      }
    };
    loadContacts();
  }, []);

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
    if (!contact.registered) return;
    setSelectedMembers((prev) =>
      prev.find((m) => m.id === contact.id)
        ? prev.filter((m) => m.id !== contact.id)
        : [...prev, contact]
    );
  };

  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const query = searchQuery.toLowerCase();
    return contacts.filter(
      (contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.mobile.includes(searchQuery)
    );
  }, [contacts, searchQuery]);

  const handleCreate = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) {
      setError("Provide a group name and select at least one member.");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: groupName.trim(),
          avatar: groupPhoto,
          memberMobiles: selectedMembers.map((member) => member.mobile),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create group");

      setGroupName("");
      setSelectedMembers([]);
      router.push(`/group-settings/${data.group?.id || ""}`);
    } catch (err: any) {
      setError(err?.message || "Unable to create group right now.");
    } finally {
      setCreating(false);
    }
  };

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
                <Image
                  src={groupPhoto}
                  alt="Group"
                  width={800}
                  height={400}
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

          {loadingContacts ? (
            <div className="py-6 text-center text-gray-500">Loading contacts...</div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
              {filteredContacts.map((contact) => {
                const isSelected = selectedMembers.some((m) => m.id === contact.id);
                const disabled = !contact.registered;

                return (
                  <motion.button
                    key={contact.id}
                    whileHover={{ scale: disabled ? 1 : 1.02 }}
                    onClick={() => toggleMember(contact)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors ${
                      isSelected ? "bg-emerald-50" : disabled ? "bg-gray-50 opacity-70" : "hover:bg-gray-50"
                    }`}
                  >
                        <Image
                          src={contact.avatar || "/logo/logo.png"}
                          alt={contact.name}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                        />

                      <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-800">{contact.name}</p>
                      <p className="text-sm text-gray-500">{contact.mobile}</p>
                    </div>
                    {contact.registered ? (
                      isSelected ? (
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: theme.primary }}
                        >
                          <Plus className="w-4 h-4 text-white rotate-45" />
                        </div>
                      ) : (
                        <ShieldCheck className="w-5 h-5 text-emerald-500" />
                      )
                    ) : (
                      <span className="text-xs font-medium text-gray-400">
                        Not registered
                      </span>
                    )}
                  </motion.button>
                );
              })}

              {!filteredContacts.length && (
                <div className="py-6 text-center text-gray-500">
                  No contacts match your search.
                </div>
              )}
            </div>
          )}
        </motion.div>
        <motion.button
          {...fadeIn}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreate}
          disabled={!groupName.trim() || selectedMembers.length === 0 || creating}
          className="w-full mt-6 py-4 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: theme.primary }}
        >
          {creating
            ? "Creating group..."
            : `Create Group with ${selectedMembers.length} member${
                selectedMembers.length !== 1 ? "s" : ""
              }`}
        </motion.button>
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
};

export default CreateGroup;
