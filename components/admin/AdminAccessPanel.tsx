"use client";

import type { FormEvent, SetStateAction } from "react";
import CreateAdminModal from "@/components/admin/CreateAdminModal";
import { adminFieldClass } from "@/components/admin/adminConstants";

export interface AdminAccount {
  _id: string;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
}

interface AdminAccessPanelProps {
  admins: AdminAccount[];
  saving: string | null;
  showCreate: boolean;
  setShowCreate: (value: SetStateAction<boolean>) => void;
  newUserId: string;
  setNewUserId: (value: SetStateAction<string>) => void;
  newEmail: string;
  setNewEmail: (value: SetStateAction<string>) => void;
  newPassword: string;
  setNewPassword: (value: SetStateAction<string>) => void;
  newIsSuperAdmin: boolean;
  setNewIsSuperAdmin: (value: SetStateAction<boolean>) => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  editingAdmin: AdminAccount | null;
  onEdit: (admin: AdminAccount) => void;
  onCloseEdit: () => void;
  editUserId: string;
  setEditUserId: (value: SetStateAction<string>) => void;
  editEmail: string;
  setEditEmail: (value: SetStateAction<string>) => void;
  editPassword: string;
  setEditPassword: (value: SetStateAction<string>) => void;
  editIsSuperAdmin: boolean;
  setEditIsSuperAdmin: (value: SetStateAction<boolean>) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (adminId: string) => void;
}

export default function AdminAccessPanel({
  admins,
  saving,
  showCreate,
  setShowCreate,
  newUserId,
  setNewUserId,
  newEmail,
  setNewEmail,
  newPassword,
  setNewPassword,
  newIsSuperAdmin,
  setNewIsSuperAdmin,
  onCreate,
  editingAdmin,
  onEdit,
  onCloseEdit,
  editUserId,
  setEditUserId,
  editEmail,
  setEditEmail,
  editPassword,
  setEditPassword,
  editIsSuperAdmin,
  setEditIsSuperAdmin,
  onUpdate,
  onDelete,
}: AdminAccessPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">
          Admin access and workspaces
        </h2>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
        >
          Create Admin
        </button>
      </div>

      {showCreate && (
        <CreateAdminModal
          userId={newUserId}
          setUserId={setNewUserId}
          email={newEmail}
          setEmail={setNewEmail}
          password={newPassword}
          setPassword={setNewPassword}
          isSuperAdmin={newIsSuperAdmin}
          setIsSuperAdmin={setNewIsSuperAdmin}
          isSaving={saving === "create"}
          onClose={() => setShowCreate(false)}
          onSubmit={onCreate}
        />
      )}

      {editingAdmin && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-admin-title"
            className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8"
          >
            <h3 id="edit-admin-title" className="mb-4 text-xl font-bold">
              Edit Admin
            </h3>
            <form onSubmit={onUpdate} className="space-y-4">
              <div>
                <label
                  htmlFor="edit-admin-user-id"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  User ID
                </label>
                <input
                  id="edit-admin-user-id"
                  type="text"
                  className={adminFieldClass}
                  value={editUserId}
                  onChange={(event) => setEditUserId(event.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="edit-admin-email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  id="edit-admin-email"
                  type="email"
                  className={adminFieldClass}
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="edit-admin-password"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  New Password (leave blank to keep current)
                </label>
                <input
                  id="edit-admin-password"
                  type="password"
                  className={adminFieldClass}
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-super"
                  checked={editIsSuperAdmin}
                  onChange={(event) => setEditIsSuperAdmin(event.target.checked)}
                />
                <label htmlFor="edit-super" className="text-sm text-gray-700">
                  Is Super Admin
                </label>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onCloseEdit}
                  className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving === editingAdmin._id}
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving === editingAdmin._id ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
          <div className="col-span-3">User ID</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2 text-center">Super Admin</div>
          <div className="col-span-3 text-center">Actions</div>
        </div>
        {admins.map((admin) => (
          <div
            key={admin._id}
            className="grid grid-cols-12 items-center gap-3 border-t border-gray-100 px-4 py-3"
          >
            <div className="col-span-3 font-medium text-gray-900">
              {admin.userId}
            </div>
            <div className="col-span-4 text-gray-600">{admin.email}</div>
            <div className="col-span-2 flex justify-center">
              {admin.isSuperAdmin ? (
                <span className="rounded bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                  Yes
                </span>
              ) : (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-600">
                  No
                </span>
              )}
            </div>
            <div className="col-span-3 flex justify-center gap-2">
              <button
                onClick={() => onEdit(admin)}
                className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(admin._id)}
                disabled={saving === admin._id}
                className="rounded-lg bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-60"
              >
                {saving === admin._id ? "..." : "Delete"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
