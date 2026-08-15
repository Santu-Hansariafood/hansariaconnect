"use client";

import { motion } from "framer-motion";
import { Theme } from "./ChatWindowTypes";

interface ChatWindowModalsProps {
  theme: Theme;
  showSaveModal: boolean;
  setShowSaveModal: (value: boolean) => void;
  saveName: string;
  setSaveName: (value: string) => void;
  saveError: string;
  savingContact: boolean;
  onSaveContact: () => Promise<void>;
  showEditModal: boolean;
  setShowEditModal: (value: boolean) => void;
  editName: string;
  setEditName: (value: string) => void;
  editError: string;
  onEditContact: () => Promise<void>;
  showClearConfirm: boolean;
  setShowClearConfirm: (value: boolean) => void;
  onClearChat: () => void;
  headerName: string;
}

export default function ChatWindowModals({
  theme,
  showSaveModal,
  setShowSaveModal,
  saveName,
  setSaveName,
  saveError,
  savingContact,
  onSaveContact,
  showEditModal,
  setShowEditModal,
  editName,
  setEditName,
  editError,
  onEditContact,
  showClearConfirm,
  setShowClearConfirm,
  onClearChat,
  headerName,
}: ChatWindowModalsProps) {
  return (
    <>
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Save Contact
            </h3>
            {saveError && (
              <div className="text-red-600 text-sm mb-2">{saveError}</div>
            )}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder="Enter name"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={onSaveContact}
                disabled={savingContact}
                className="px-4 py-2 rounded-xl text-white"
                style={{ backgroundColor: theme.primary }}
              >
                {savingContact ? "Saving..." : "Save"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Edit Contact Name
            </h3>
            {editError && (
              <div className="text-red-600 text-sm mb-2">{editError}</div>
            )}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-3 border rounded-xl"
                placeholder={headerName}
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={onEditContact}
                className="px-4 py-2 rounded-xl text-white"
                style={{ backgroundColor: theme.primary }}
              >
                Update
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6"
          >
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Clear Chat
            </h3>
            <p className="text-sm text-gray-600">
              This will remove all messages from this conversation locally. Are
              you sure?
            </p>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onClearChat();
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 rounded-xl text-white"
                style={{ backgroundColor: theme.primary }}
              >
                Clear
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
