"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, LoaderCircle, Pencil, Trash2, X } from "lucide-react";

type Theme = { primary?: string };

type Contact = {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
};

interface Props {
  contact: Contact | null;
  onClose: () => void;
  onSave: (name: string) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  theme?: Theme;
}

const ManageContactModal: React.FC<Props> = ({
  contact,
  onClose,
  onSave,
  onDelete,
  theme,
}) => {
  const [name, setName] = useState(contact?.name || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!contact) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !deleting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [contact, deleting, onClose, saving]);

  const handleSave = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setError("Please enter a name for this contact.");
      return;
    }

    setError("");
    setSaving(true);
    try {
      await onSave(nextName);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We couldn't save this contact. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setError("");
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "We couldn't delete this contact. Please try again.",
      );
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  if (!contact) return null;

  const accent = theme?.primary || "#059669";

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving && !deleting) {
            onClose();
          }
        }}
      >
        <motion.section
          role="dialog"
          aria-modal="true"
          aria-labelledby="manage-contact-title"
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.98 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl sm:max-w-lg sm:rounded-[2rem]"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-100 bg-white/95 px-5 pb-4 pt-5 backdrop-blur sm:px-7 sm:pt-7">
            <div className="flex min-w-0 items-center gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                style={{ backgroundColor: accent }}
              >
                <Pencil className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h2 id="manage-contact-title" className="text-lg font-bold text-slate-900">
                  Manage contact
                </h2>
                <p className="truncate text-sm text-slate-500">
                  Update details or remove this contact
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              aria-label="Close manage contact"
              className="ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
            <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contact details
              </p>
              {contact.mobile && (
                <p className="mt-2 break-all text-sm font-medium text-slate-700">
                  {contact.mobile}
                </p>
              )}
              {contact.email && (
                <p className="mt-1 break-all text-sm text-slate-500">
                  {contact.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="manage-contact-name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Display name
              </label>
              <input
                id="manage-contact-name"
                type="text"
                autoFocus
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSave();
                  }
                }}
                maxLength={100}
                placeholder="Enter contact name"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            {confirmDelete ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="font-semibold text-red-900">Delete this contact?</p>
                    <p className="mt-1 text-sm text-red-700">
                      This removes the contact from your address book. Your chat history will remain.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="min-h-11 rounded-xl border border-red-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-red-100"
                  >
                    Keep contact
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {deleting && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    Delete contact
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || deleting}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete contact
              </button>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-100 bg-white/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:justify-end sm:px-7 sm:py-5">
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="min-h-12 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:min-h-11"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || deleting || confirmDelete}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-11"
              style={{ backgroundColor: accent }}
            >
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
};

export default ManageContactModal;
