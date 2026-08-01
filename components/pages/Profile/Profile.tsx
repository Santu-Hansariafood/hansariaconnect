"use client";

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  Check,
  Edit2,
  LoaderCircle,
  Save,
  X,
} from "lucide-react";
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
  onLogout?: () => void;
};

type EditableField = "name" | "about" | null;

const defaultAbout = "Hey there! I am using HansariaConnect";

const buildProfileState = (user: User) => ({
  name: user.name || "User",
  about: defaultAbout,
  mobile: user.mobile,
  photo: user.photo || "/logo/logo.png",
});

const Profile: React.FC<ProfileProps> = ({ user, theme, onLogout }) => {
  const [profile, setProfile] = useState(() => buildProfileState(user));
  const [draftProfile, setDraftProfile] = useState(() => buildProfileState(user));
  const [editingField, setEditingField] = useState<EditableField>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  useEffect(() => {
    const baseProfile = buildProfileState(user);
    setProfile(baseProfile);
    setDraftProfile(baseProfile);

    const fetchProfile = async () => {
      if (!user.id) return;

      try {
        const res = await fetch(`/api/profile/${user.id}`, {
          credentials: "include",
        });
        const data = await res.json();

        if (data?.profile) {
          const loadedProfile = {
            name: data.profile.name || baseProfile.name,
            about: data.profile.about || defaultAbout,
            mobile: user.mobile,
            photo: data.profile.photo || "/logo/logo.png",
          };

          setProfile(loadedProfile);
          setDraftProfile(loadedProfile);
        }
      } catch {
        setStatusMessage("Unable to load your latest profile right now.");
      }
    };

    fetchProfile();
  }, [user]);

  const hasChanges = useMemo(() => {
    return (
      draftProfile.name.trim() !== profile.name.trim() ||
      draftProfile.about.trim() !== profile.about.trim() ||
      draftProfile.photo !== profile.photo
    );
  }, [draftProfile, profile]);

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("file", file);

    try {
      setIsUploading(true);
      setStatusMessage("");

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const contentType = res.headers.get("content-type") || "";

      if (!contentType.includes("application/json")) return;

      const data = await res.json();
      if (data?.url) {
        setDraftProfile((prev) => ({ ...prev, photo: data.url }));
        setStatusMessage("Photo updated. Save changes to keep it.");
      }
    } catch {
      setStatusMessage("Photo upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    const trimmedName = draftProfile.name.trim();
    if (!trimmedName) {
      setStatusMessage("Name cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);
      setStatusMessage("");

      const res = await fetch(`/api/profile/${user.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mobile: user.mobile,
          name: trimmedName,
          about: draftProfile.about.trim(),
          photo: draftProfile.photo,
          theme,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) return;

      const data = await res.json();
      if (data?.profile) {
        const savedProfile = {
          name: data.profile.name || trimmedName,
          about: data.profile.about ?? draftProfile.about.trim(),
          mobile: user.mobile,
          photo: data.profile.photo || draftProfile.photo,
        };

        setProfile(savedProfile);
        setDraftProfile(savedProfile);
        setEditingField(null);
        setStatusMessage("Profile updated.");
      } else if (data?.error) {
        setStatusMessage(data.error);
      }
    } catch {
      setStatusMessage("We could not save your profile right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setDraftProfile(profile);
    setEditingField(null);
    setStatusMessage("");
  };

  const accentColor = theme.primary || "#008069";
  const navbarUser = {
    ...user,
    name: profile.name,
    photo: profile.photo,
  };

  return (
    <div className="min-h-screen bg-[#efeae2]">
      <Navbar user={navbarUser} onLogout={onLogout} />

      <div className="mx-auto max-w-2xl px-4 py-5 sm:py-7">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-[28px] border border-[#d9dbdf] bg-[#f7f8fa] shadow-[0_18px_45px_rgba(17,27,33,0.12)]"
        >
          <div
            className="px-5 py-5 text-white sm:px-6"
            style={{
              background: `linear-gradient(180deg, ${accentColor} 0%, #0b141a 150%)`,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-white/70">
                  Profile
                </p>
                <h1 className={`mt-1 text-2xl font-semibold ${theme.textSize || ""}`}>
                  Your info
                </h1>
                <p className="mt-1 text-sm text-white/80">
                  This is how your profile appears across chats.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {hasChanges && (
                  <button
                    onClick={handleCancelChanges}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
                    title="Cancel changes"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}

                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: "#00a884" }}
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </button>
              </div>
            </div>
          </div>

          <motion.div {...fadeIn} className="px-4 pb-5 pt-6 sm:px-6">
            <div className="flex flex-col items-center border-b border-[#e9edef] pb-6">
              <div className="relative">
                <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-lg sm:h-36 sm:w-36">
                  <Image
                    src={draftProfile.photo}
                    alt="Profile"
                    fill
                    priority
                    sizes="(max-width: 640px) 128px, 144px"
                    className="object-cover"
                  />
                </div>

                <label
                  className="absolute bottom-1 right-1 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-white shadow-lg transition hover:scale-105"
                  style={{ backgroundColor: accentColor }}
                >
                  {isUploading ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </label>
              </div>

              <p className="mt-4 text-lg font-semibold text-[#111b21]">
                {draftProfile.name}
              </p>
              <p className="mt-1 text-sm text-[#667781]">{draftProfile.mobile}</p>
            </div>

            {statusMessage && (
              <div className="mt-4 rounded-2xl border border-[#dfe5e7] bg-white px-4 py-3 text-sm text-[#54656f]">
                {statusMessage}
              </div>
            )}

            <div className="mt-4 space-y-4">
              <section className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#e9edef]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667781]">
                      Name
                    </p>
                    <p className="mt-1 text-sm text-[#54656f]">
                      This is not your username or pin. This name will be visible to your contacts.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setEditingField((current) =>
                        current === "name" ? null : "name",
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] transition hover:bg-[#e4e7eb]"
                    title="Edit name"
                  >
                    {editingField === "name" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Edit2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {editingField === "name" ? (
                  <input
                    type="text"
                    value={draftProfile.name}
                    onChange={(e) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Enter your name"
                    className="w-full rounded-2xl border border-[#d1d7db] bg-[#f7f8fa] px-4 py-3 text-[#111b21] outline-none transition focus:border-transparent focus:ring-2"
                    style={{ boxShadow: `0 0 0 2px ${accentColor}22` }}
                  />
                ) : (
                  <p className="text-base font-medium text-[#111b21]">
                    {draftProfile.name}
                  </p>
                )}
              </section>

              <section className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#e9edef]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667781]">
                      About
                    </p>
                    <p className="mt-1 text-sm text-[#54656f]">
                      Add a short line about yourself, just like WhatsApp status text.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setEditingField((current) =>
                        current === "about" ? null : "about",
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] transition hover:bg-[#e4e7eb]"
                    title="Edit about"
                  >
                    {editingField === "about" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Edit2 className="h-4 w-4" />
                    )}
                  </button>
                </div>

                {editingField === "about" ? (
                  <textarea
                    value={draftProfile.about}
                    onChange={(e) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        about: e.target.value,
                      }))
                    }
                    rows={4}
                    placeholder="Write something about yourself"
                    className="w-full resize-none rounded-2xl border border-[#d1d7db] bg-[#f7f8fa] px-4 py-3 text-[#111b21] outline-none transition focus:border-transparent focus:ring-2"
                    style={{ boxShadow: `0 0 0 2px ${accentColor}22` }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-base text-[#111b21]">
                    {draftProfile.about || "No about added yet."}
                  </p>
                )}
              </section>

              <section className="rounded-3xl bg-white px-5 py-4 shadow-sm ring-1 ring-[#e9edef]">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#667781]">
                  Phone
                </p>
                <p className="mt-3 text-base font-medium text-[#111b21]">
                  {draftProfile.mobile}
                </p>
                <p className="mt-1 text-sm text-[#54656f]">
                  Your mobile number is linked to the account and cannot be changed here.
                </p>
              </section>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Profile;
