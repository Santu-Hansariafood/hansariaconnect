"use client";

import type { FormEvent, SetStateAction } from "react";
import { adminFieldClass } from "@/components/admin/adminConstants";

interface CreateAdminModalProps {
  userId: string;
  setUserId: (value: SetStateAction<string>) => void;
  email: string;
  setEmail: (value: SetStateAction<string>) => void;
  password: string;
  setPassword: (value: SetStateAction<string>) => void;
  isSuperAdmin: boolean;
  setIsSuperAdmin: (value: SetStateAction<boolean>) => void;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function CreateAdminModal({
  userId,
  setUserId,
  email,
  setEmail,
  password,
  setPassword,
  isSuperAdmin,
  setIsSuperAdmin,
  isSaving,
  onClose,
  onSubmit,
}: CreateAdminModalProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-title"
        className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8"
      >
        <h3 id="create-admin-title" className="mb-4 text-xl font-bold">
          Create New Admin
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Create a separate admin workspace. The Admin ID is chosen here; the
          database record ID is generated automatically.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="create-admin-user-id"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Admin ID
            </label>
            <input
              id="create-admin-user-id"
              type="text"
              className={adminFieldClass}
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              autoComplete="username"
              placeholder="For example, branch-admin"
              required
            />
          </div>
          <div>
            <label
              htmlFor="create-admin-email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Email
            </label>
            <input
              id="create-admin-email"
              type="email"
              className={adminFieldClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label
              htmlFor="create-admin-password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="create-admin-password"
              type="password"
              className={adminFieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="new-super"
              checked={isSuperAdmin}
              onChange={(event) => setIsSuperAdmin(event.target.checked)}
            />
            <label htmlFor="new-super" className="text-sm text-gray-700">
              Is Super Admin
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {isSaving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
