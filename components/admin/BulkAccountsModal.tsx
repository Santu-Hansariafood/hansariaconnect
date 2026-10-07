"use client";

import type { ChangeEvent, FormEvent, RefObject } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import { ACCOUNT_TEMPLATE_HEADERS } from "@/components/admin/adminConstants";

export interface BulkUserInput {
  name: string;
  email: string;
  mobile: string;
}

interface BulkAccountsModalProps {
  isPlatformAdmin: boolean;
  error: string;
  accounts: BulkUserInput[];
  fileName: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  isSaving: boolean;
  onDismissError: () => void;
  onClose: () => void;
  onDownloadTemplate: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export default function BulkAccountsModal({
  isPlatformAdmin,
  error,
  accounts,
  fileName,
  fileInputRef,
  isSaving,
  onDismissError,
  onClose,
  onDownloadTemplate,
  onUpload,
  onSubmit,
}: BulkAccountsModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/60 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-accounts-title"
        className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header
          className={`relative overflow-hidden px-5 py-6 text-white sm:px-8 sm:py-8 ${
            isPlatformAdmin
              ? "bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900"
              : "bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-900"
          }`}
        >
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/5" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                  Account onboarding
                </p>
                <h2
                  id="bulk-accounts-title"
                  className="mt-1 text-xl font-bold sm:text-2xl"
                >
                  Register multiple accounts
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-white/75">
                  Prepare your spreadsheet, upload it, review the validated row
                  count, then register in one step.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close account registration"
              className="relative rounded-xl p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-2 sm:max-w-lg sm:gap-3">
            {[
              ["1", "Download"],
              ["2", "Fill & upload"],
              ["3", "Register"],
            ].map(([number, label], index) => (
              <div
                key={number}
                className="flex items-center gap-2 text-xs font-medium text-white/75 sm:text-sm"
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 2 && accounts.length
                      ? "bg-emerald-400 text-emerald-950"
                      : "bg-white/15 text-white ring-1 ring-white/15"
                  }`}
                >
                  {index === 2 && accounts.length ? "✓" : number}
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </header>

        <div className="space-y-5 p-5 sm:p-8">
          {error && (
            <div
              role="alert"
              className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onDismissError}
                className="shrink-0 font-semibold text-rose-700 hover:text-rose-900"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                  1
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Download the sample
                  </h3>
                  <p className="text-xs text-slate-500">
                    Use the required workbook and sheet format
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {ACCOUNT_TEMPLATE_HEADERS.map((header) => (
                  <span
                    key={header}
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    {header}
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={onDownloadTemplate}
                className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isPlatformAdmin
                    ? "border-indigo-200 text-indigo-800 hover:bg-indigo-50 focus:ring-indigo-500"
                    : "border-emerald-200 text-emerald-800 hover:bg-emerald-50 focus:ring-emerald-500"
                }`}
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Download Excel sample
              </button>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                  2
                </span>
                <div>
                  <h3 className="font-semibold text-slate-900">
                    Fill in account details
                  </h3>
                  <p className="text-xs text-slate-500">
                    One account per row, up to 100 rows
                  </p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">•</span>
                  Keep the sample column names and order unchanged.
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-emerald-600">•</span>
                  Complete Name, Email, and 10-digit mobile.
                </li>
              </ul>
            </section>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-bold text-slate-700 shadow-sm">
                3
              </span>
              <div>
                <h3 className="font-semibold text-slate-900">
                  Upload and register
                </h3>
                <p className="text-xs text-slate-500">Excel workbook (.xlsx)</p>
              </div>
            </div>
            <label
              htmlFor="account-excel-file"
              className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-white px-4 py-6 text-center transition ${
                isPlatformAdmin
                  ? "border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/40"
                  : "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40"
              }`}
            >
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                  isPlatformAdmin
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                <Upload className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-3 text-sm font-semibold text-slate-800">
                {fileName ? "Choose a different workbook" : "Choose your completed workbook"}
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Select an .xlsx file using the Accounts sheet
              </span>
              <input
                ref={fileInputRef}
                id="account-excel-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={onUpload}
                className="sr-only"
              />
            </label>

            {fileName && (
              <div
                className="mt-4 flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                role="status"
                aria-live="polite"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 shrink-0 text-emerald-700" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-emerald-950">
                      {fileName}
                    </p>
                    <p className="text-xs text-emerald-800">Ready to register</p>
                  </div>
                </div>
                <span className="shrink-0 self-start rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200 sm:self-auto">
                  {accounts.length} / 100 accounts
                </span>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !accounts.length}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                  isPlatformAdmin
                    ? "bg-indigo-700 hover:bg-indigo-800 focus:ring-indigo-600"
                    : "bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-600"
                }`}
              >
                {isSaving ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Registering...
                  </>
                ) : (
                  `Register ${accounts.length || ""} account${accounts.length === 1 ? "" : "s"}`
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
