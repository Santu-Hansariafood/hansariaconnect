"use client";

import { useState, type FormEvent } from "react";
import { adminFieldClass } from "@/components/admin/adminConstants";

type ApiKeyOption = {
  _id: string;
  name: string;
  ownerUserId?: string;
};

type TemplateOption = {
  _id: string;
  name: string;
};

type HistoryRow = {
  date: string;
  apiKeyId: string;
  apiKeyName: string;
  templateName: string;
  count: number;
};

const getIndiaDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const today = getIndiaDate(new Date());
const monthAgo = getIndiaDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));

export default function AdminMessageHistoryPanel({
  apiKeys,
  templates,
  isPlatformAdmin,
}: {
  apiKeys: ApiKeyOption[];
  templates: TemplateOption[];
  isPlatformAdmin: boolean;
}) {
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [apiKeyId, setApiKeyId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);

  const loadHistory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ from, to });
    if (apiKeyId) params.set("apiKeyId", apiKeyId);
    if (templateName) params.set("templateName", templateName);

    try {
      const response = await fetch(
        `/api/admin/message-history?${params.toString()}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not load API message history.");
      }
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTruncated(Boolean(data.truncated));
      setHasRun(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load API message history.",
      );
      setRows([]);
      setHasRun(false);
    } finally {
      setLoading(false);
    }
  };

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800">
          Reporting
        </p>
        <h3 className="mt-1 text-xl font-bold text-slate-900">
          API message history
        </h3>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
          Count API-created chat messages by India date, API key, and saved
          template. Each recipient message counts once. This report does not
          represent carrier SMS delivery.
        </p>
      </div>

      <form
        onSubmit={loadHistory}
        className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <label className="text-sm font-medium text-slate-700">
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
            className={`mt-1 ${adminFieldClass}`}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          To
          <input
            type="date"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
            className={`mt-1 ${adminFieldClass}`}
            required
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          API key
          <select
            value={apiKeyId}
            onChange={(event) => setApiKeyId(event.target.value)}
            className={`mt-1 ${adminFieldClass}`}
          >
            <option value="">All API keys</option>
            {apiKeys.map((key) => (
              <option key={key._id} value={key._id}>
                {key.name}
                {isPlatformAdmin && key.ownerUserId
                  ? ` (${key.ownerUserId})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Template
          <select
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            className={`mt-1 ${adminFieldClass}`}
          >
            <option value="">All templates</option>
            {templates.map((template) => (
              <option key={template._id} value={template.name}>
                {template.name}
              </option>
            ))}
            <option value="(No template recorded)">
              No template recorded
            </option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="self-end rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading…" : "Show history"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          {error}
        </p>
      )}

      {hasRun && !error && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-700">
            {total.toLocaleString()} messages in the selected range
          </p>
          {truncated && (
            <p className="mb-3 text-sm text-amber-800">
              Results were capped. Narrow the date range or choose an API key.
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date (IST)</th>
                  <th className="px-4 py-3 font-semibold">API key</th>
                  <th className="px-4 py-3 font-semibold">Template</th>
                  <th className="px-4 py-3 text-right font-semibold">Count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => (
                  <tr key={`${row.date}-${row.apiKeyId}-${row.templateName}-${index}`}>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      {row.date}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.apiKeyName}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.templateName}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-slate-900">
                      {row.count.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      No API messages found for these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
