"use client";

import { useCallback, useEffect, useState, ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  Camera,
  Edit2,
  UserPlus,
  UserMinus,
  Shield,
} from "lucide-react";
import { fadeIn } from "@/utils/animations/animations";
import Loading from "@/components/common/Loading/Loading";

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

type GroupMember = {
  id: string;
  name: string;
  avatar: string;
  mobile: string;
  role: "admin" | "member";
};

type GroupResponse = {
  id: string;
  name: string;
  avatar: string;
  members: GroupMember[];
  adminMobile: string;
  isAdmin?: boolean;
};

const GroupSettings = ({ user, theme }: { user: User; theme: Theme }) => {
  const params = useParams();
  const id = String((params as any)?.id || "");
  const router = useRouter();

  const [groupData, setGroupData] = useState<GroupResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [memberActionId, setMemberActionId] = useState("");
  const [addingMembers, setAddingMembers] = useState(false);

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${id}`, { cache: "no-store", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to load group");
      }
      setGroupData(data.group);
      setNameDraft(data.group?.name || "");
    } catch (err: any) {
      setGroupData(null);
      setError(err?.message || "Unable to load group");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  const isAdmin = !!groupData?.isAdmin;

  const updateGroup = async (payload: { name?: string; avatar?: string }) => {
    if (!groupData?.id) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Update failed");
      setGroupData(data.group);
      setNameDraft(data.group?.name || "");
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || "Failed to update group");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      await updateGroup({ avatar: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleNameSave = async () => {
    if (!isAdmin || !nameDraft.trim() || nameDraft === groupData?.name) {
      setIsEditing(false);
      return;
    }
    await updateGroup({ name: nameDraft.trim() });
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!isAdmin || !groupData?.id) return;
    setMemberActionId(memberId);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupData.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to remove member");
      setGroupData(data.group);
    } catch (err: any) {
      setError(err?.message || "Unable to remove member");
    } finally {
      setMemberActionId("");
    }
  };

  const handleMakeAdmin = async (memberId: string) => {
    if (!isAdmin || !groupData?.id) return;
    setMemberActionId(memberId);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupData.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ memberId, role: "admin" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to promote member");
      setGroupData(data.group);
    } catch (err: any) {
      setError(err?.message || "Unable to promote member");
    } finally {
      setMemberActionId("");
    }
  };

  const handleAddMembers = async () => {
    if (!isAdmin || !groupData?.id) return;
    const input = prompt("Enter 10-digit mobile numbers separated by commas");
    if (!input) return;
    const mobiles = input
      .split(",")
      .map((mobile) => mobile.replace(/\D/g, ""))
      .filter((mobile) => /^\d{10}$/.test(mobile));
    if (!mobiles.length) {
      setError("Provide valid 10-digit mobile numbers.");
      return;
    }

    setAddingMembers(true);
    setError("");
    try {
      const res = await fetch(`/api/groups/${groupData.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ mobiles }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to add members");
      setGroupData(data.group);
    } catch (err: any) {
      setError(err?.message || "Unable to add members");
    } finally {
      setAddingMembers(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen ${theme.wallpaper}`}>
        <Loading />
      </div>
    );
  }

  if (!groupData) {
    return (
      <div className={`min-h-screen ${theme.wallpaper}`}>
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-center">
          <p className="text-gray-600">{error || "Group not found."}</p>
          <button
            onClick={() => router.push("/groups")}
            className="rounded-xl bg-emerald-600 px-6 py-3 text-white"
          >
            Back to Groups
          </button>
        </div>
      </div>
    );
  }

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
                <Image
                  src={
                    groupData.avatar ||
                    "/logo/logo.png"
                  }
                  alt="Group"
                  width={96}
                  height={96}
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
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none transition-colors text-lg font-semibold"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-800">
                  {groupData.name}
                </h2>
              )}
              {isEditing && isAdmin && (
                <div className="mt-3 flex gap-3">
                  <button
                    onClick={handleNameSave}
                    disabled={saving}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setNameDraft(groupData.name);
                    }}
                    className="rounded-xl bg-gray-200 px-4 py-2 text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
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
            {groupData.members.map((member) => {
              const isMemberAdmin = member.role === "admin";
              return (
                <motion.div
                  key={member.id}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl"
                >
                    <Image
                      src={
                        member.avatar ||
                        "/logo/logo.png"
                      }
                      alt={member.name}
                      width={48}
                      height={48}
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
                        onClick={() => handleMakeAdmin(member.id)}
                        className="p-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 transition-colors"
                        title="Make Admin"
                        disabled={memberActionId === member.id}
                      >
                        <Shield className="w-4 h-4" />
                      </motion.button>

                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleRemoveMember(member.id)}
                        className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200 transition-colors"
                        title="Remove Member"
                        disabled={memberActionId === member.id}
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
              onClick={handleAddMembers}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white"
              style={{ backgroundColor: theme.primary }}
              disabled={addingMembers}
            >
              <UserPlus className="w-5 h-5" />
              {addingMembers ? "Adding..." : "Add Members"}
            </motion.button>
          )}
          {error && (
            <p className="mt-3 text-center text-sm text-red-600">{error}</p>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default GroupSettings;
