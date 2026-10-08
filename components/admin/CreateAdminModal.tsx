"use client";

import type { FormEvent, SetStateAction } from "react";
import { adminFieldClass } from "@/components/admin/adminConstants";
import { ShieldCheck, X } from "lucide-react";

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
  error: string;
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
  error,
  onClose,
  onSubmit,
}: CreateAdminModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-admin-title"
        className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl shadow-slate-950/25"
      >
        <div className="flex items-start justify-between gap-4 bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-800 px-6 py-6 text-white sm:px-8">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <ShieldCheck aria-hidden="true" className="size-6" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
                Workspace management
              </p>
              <h3 id="create-admin-title" className="mt-1 text-2xl font-bold">
                Create an admin
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-indigo-100">
                Set up a private workspace with its own templates, users, and
                API keys.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-indigo-100 transition hover:bg-white/10 hover:text-white"
            aria-label="Close dialog"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-5 p-6 sm:p-8">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
            >
              {error}
            </div>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="create-admin-user-id"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
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
                placeholder="e.g. branch-admin"
                minLength={3}
                maxLength={40}
                pattern="[a-zA-Z0-9._-]+"
                title="Use 3–40 letters, numbers, dots, underscores, or hyphens."
                required
              />
              <p className="mt-1.5 text-xs text-slate-500">
                3–40 letters, numbers, dots, underscores, or hyphens.
              </p>
            </div>
            <div>
              <label
                htmlFor="create-admin-email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>
              <input
                id="create-admin-email"
                type="email"
                className={adminFieldClass}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={254}
                placeholder="admin@company.com"
                required
              />
            </div>
          </div>
          <div>
            <label
              htmlFor="create-admin-password"
              className="mb-1.5 block text-sm font-semibold text-slate-700"
            >
              Temporary password
            </label>
            <input
              id="create-admin-password"
              type="password"
              className={adminFieldClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              aria-describedby="create-admin-password-hint"
              required
            />
            <p id="create-admin-password-hint" className="mt-1.5 text-xs text-slate-500">
              Use 8–72 characters. The new admin can change it after signing in.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4 transition hover:bg-indigo-50">
            <input
              type="checkbox"
              id="new-super"
              checked={isSuperAdmin}
              onChange={(event) => setIsSuperAdmin(event.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300 text-indigo-700 focus:ring-indigo-600"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-800">
                Grant super admin access
              </span>
              <span className="mt-1 block text-xs leading-5 text-slate-600">
                Super admins can manage all workspaces and create other admins.
              </span>
            </span>
          </label>
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-900/15 transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Creating workspace..." : "Create admin"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
