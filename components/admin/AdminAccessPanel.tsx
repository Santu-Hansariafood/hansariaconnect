"use client";

import type { FormEvent, SetStateAction } from "react";
import { Building2, Plus, ShieldCheck, Users } from "lucide-react";
import CreateAdminModal from "@/components/admin/CreateAdminModal";
import { adminFieldClass } from "@/components/admin/adminConstants";

export interface AdminAccount {
  _id: string;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  companyName?: string;
  companyDomain?: string;
  companyVerificationRequested?: boolean;
  isCompanyVerified?: boolean;
  createdAt: string;
}

interface AdminAccessPanelProps {
  admins: AdminAccount[];
  saving: string | null;
  showCreate: boolean;
  setShowCreate: (value: SetStateAction<boolean>) => void;
  createError: string;
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
  editCompanyName: string;
  setEditCompanyName: (value: SetStateAction<string>) => void;
  editCompanyDomain: string;
  setEditCompanyDomain: (value: SetStateAction<string>) => void;
  editCompanyVerified: boolean;
  setEditCompanyVerified: (value: SetStateAction<boolean>) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (adminId: string) => void;
}

export default function AdminAccessPanel({
  admins,
  saving,
  showCreate,
  setShowCreate,
  createError,
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
  editCompanyName,
  setEditCompanyName,
  editCompanyDomain,
  setEditCompanyDomain,
  editCompanyVerified,
  setEditCompanyVerified,
  onUpdate,
  onDelete,
}: AdminAccessPanelProps) {
  const superAdminCount = admins.filter((admin) => admin.isSuperAdmin).length;
  const pendingVerificationCount = admins.filter(
    (admin) => admin.companyVerificationRequested && !admin.isCompanyVerified,
  ).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50 p-6 shadow-sm sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-700">
            Platform controls
          </p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Admin workspaces
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
            Create and manage isolated admin accounts. Each workspace keeps its
            own templates, users, and API keys.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
        >
          <Plus aria-hidden="true" className="size-4" />
          Create admin
        </button>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Total workspaces",
            value: admins.length,
            icon: Users,
            tint: "bg-indigo-50 text-indigo-700",
          },
          {
            label: "Super admins",
            value: superAdminCount,
            icon: ShieldCheck,
            tint: "bg-violet-50 text-violet-700",
          },
          {
            label: "Verification requests",
            value: pendingVerificationCount,
            icon: Building2,
            tint: "bg-amber-50 text-amber-700",
          },
        ].map(({ label, value, icon: Icon, tint }) => (
          <div
            key={label}
            className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <span className={`grid size-11 place-items-center rounded-xl ${tint}`}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span>
              <span className="block text-2xl font-bold text-slate-950">
                {value}
              </span>
              <span className="block text-xs font-medium text-slate-500">
                {label}
              </span>
            </span>
          </div>
        ))}
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
          error={createError}
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
              <div>
                <label
                  htmlFor="edit-company-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Company display name
                </label>
                <input
                  id="edit-company-name"
                  value={editCompanyName}
                  onChange={(event) => setEditCompanyName(event.target.value)}
                  maxLength={100}
                  className={adminFieldClass}
                />
              </div>
              <div>
                <label
                  htmlFor="edit-company-domain"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Company domain
                </label>
                <input
                  id="edit-company-domain"
                  value={editCompanyDomain}
                  onChange={(event) => setEditCompanyDomain(event.target.value)}
                  maxLength={253}
                  className={adminFieldClass}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={editCompanyVerified}
                  onChange={(event) =>
                    setEditCompanyVerified(event.target.checked)
                  }
                />
                Approve verified company badge
              </label>
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

      <section
        aria-label="Admin account directory"
        className="space-y-3"
      >
        {admins.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-indigo-50 text-indigo-700">
              <Users aria-hidden="true" className="size-6" />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">
              No admin workspaces yet
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Create the first workspace to give an admin access to their own tools.
            </p>
          </div>
        ) : (
          admins.map((admin) => (
            <article
              key={admin._id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md sm:flex-row sm:items-center sm:p-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100 text-lg font-bold uppercase text-indigo-800">
                  {admin.userId.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-950">
                      {admin.userId}
                    </h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        admin.isSuperAdmin
                          ? "bg-violet-100 text-violet-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {admin.isSuperAdmin ? "Super admin" : "Admin"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-slate-600">
                    {admin.email}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>{admin.companyName || "No company name"}</span>
                    {admin.companyDomain && <span>{admin.companyDomain}</span>}
                    {admin.companyVerificationRequested &&
                      !admin.isCompanyVerified && (
                        <span className="font-semibold text-amber-700">
                          Verification pending
                        </span>
                      )}
                    {admin.isCompanyVerified && (
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700">
                        <ShieldCheck aria-hidden="true" className="size-3.5" />
                        Verified company
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 border-t border-slate-100 pt-3 sm:border-0 sm:pt-0">
                <button
                  onClick={() => onEdit(admin)}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 sm:flex-none"
                >
                  Edit
                </button>
                <button
                  onClick={() => onDelete(admin._id)}
                  disabled={saving === admin._id}
                  className="flex-1 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
                >
                  {saving === admin._id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
