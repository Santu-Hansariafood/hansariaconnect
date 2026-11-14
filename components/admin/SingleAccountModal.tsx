"use client";

import { useState, type FormEvent } from "react";
import { UserPlus, X } from "lucide-react";
import type { BulkUserInput } from "@/components/admin/BulkAccountsModal";

interface SingleAccountModalProps {
  isPlatformAdmin: boolean;
  error: string;
  isSaving: boolean;
  onDismissError: () => void;
  onClose: () => void;
  onSubmit: (account: BulkUserInput) => void;
}

export default function SingleAccountModal({
  isPlatformAdmin,
  error,
  isSaving,
  onDismissError,
  onClose,
  onSubmit,
}: SingleAccountModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const accent = isPlatformAdmin ? "indigo" : "emerald";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      mobile: mobile.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="single-account-title"
        className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
      >
        <header
          className={`flex items-start justify-between gap-4 px-5 py-6 text-white sm:px-8 sm:py-7 ${
            isPlatformAdmin
              ? "bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900"
              : "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900"
          }`}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
              <UserPlus className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                Account onboarding
              </p>
              <h2 id="single-account-title" className="mt-1 text-xl font-bold">
                Register one account
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/75">
                Enter the account details below. Use the multiple-account
                option to upload a spreadsheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close single account registration"
            className="rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-8">
          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 font-semibold text-rose-700 hover:text-rose-900 dark:text-rose-300"
              >
                Dismiss
              </button>
            </div>
          )}

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Name
            <input
              required
              maxLength={100}
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Account holder name"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Email
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="name@example.com"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Indian mobile number
            <input
              required
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              pattern="[6-9][0-9]{9}"
              maxLength={10}
              value={mobile}
              onChange={(event) =>
                setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
              }
              className="rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="10-digit mobile number"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                accent === "indigo"
                  ? "bg-indigo-700 hover:bg-indigo-800"
                  : "bg-emerald-700 hover:bg-emerald-800"
              }`}
            >
              {isSaving ? "Registering..." : "Register account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
