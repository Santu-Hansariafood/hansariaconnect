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

type BulkJobRow = {
  jobId: string;
  date: string;
  apiKeyName: string;
  templateName: string;
  status: string;
  total: number;
  sent: number;
  failed: number;
  pending: number;
};

type BulkJobDetails = {
  status: string;
  recipients: Array<{
    recipient: string;
    status: string;
    error?: string;
    messageId?: string;
  }>;
};

const getIndiaDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
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
  const [jobs, setJobs] = useState<BulkJobRow[]>([]);
  const [jobDetails, setJobDetails] = useState<Record<string, BulkJobDetails>>(
    {},
  );
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null);
  const [jobError, setJobError] = useState("");
  const [hasRun, setHasRun] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [dataJobsTruncated, setDataJobsTruncated] = useState(false);

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
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
      setJobDetails({});
      setExpandedJobId(null);
      setJobError("");
      setTruncated(Boolean(data.truncated));
      setDataJobsTruncated(Boolean(data.jobsTruncated));
      setHasRun(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load API message history.",
      );
      setRows([]);
      setJobs([]);
      setDataJobsTruncated(false);
      setJobDetails({});
      setExpandedJobId(null);
      setHasRun(false);
    } finally {
      setLoading(false);
    }
  };

  const total = rows.reduce((sum, row) => sum + row.count, 0);

  const toggleJobDetails = async (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    setJobError("");
    setLoadingJobId(jobId);
    try {
      const response = await fetch(
        `/api/admin/message-history/${encodeURIComponent(jobId)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Could not load recipient results.");
      }
      setJobDetails((previous) => ({
        ...previous,
        [jobId]: data as BulkJobDetails,
      }));
    } catch (loadError) {
      setJobError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load recipient results.",
      );
    } finally {
      setLoadingJobId(null);
    }
  };

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
            <option value="(No template recorded)">No template recorded</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={loading}
          className="self-end rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading…" : hasRun ? "Refresh history" : "Show history"}
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
                  <tr
                    key={`${row.date}-${row.apiKeyId}-${row.templateName}-${index}`}
                  >
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
          <h4 className="mb-3 mt-7 text-base font-bold text-slate-900">
            Bulk send jobs
          </h4>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <article
                  key={job.jobId}
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <button
                    type="button"
                    onClick={() => void toggleJobDetails(job.jobId)}
                    className="grid w-full gap-2 p-4 text-left hover:bg-slate-50 sm:grid-cols-[1fr_1fr_1fr_auto]"
                    aria-expanded={expandedJobId === job.jobId}
                  >
                    <span>
                      <span className="block text-xs text-slate-500">
                        {new Date(job.date).toLocaleString(undefined, {
                          timeZone: "Asia/Kolkata",
                        })}{" "}
                        IST
                      </span>
                      <span className="mt-1 block font-semibold text-slate-900">
                        {job.templateName}
                      </span>
                    </span>
                    <span className="text-sm text-slate-700">
                      {job.apiKeyName}
                    </span>
                    <span className="text-sm text-slate-700">
                      {job.sent} sent · {job.failed} failed · {job.pending}{" "}
                      pending
                    </span>
                    <span className="self-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {job.status}
                    </span>
                  </button>
                  {expandedJobId === job.jobId && (
                    <div className="border-t border-slate-200 bg-slate-50 p-4">
                      {loadingJobId === job.jobId ? (
                        <p className="text-sm text-slate-600">
                          Loading recipient results…
                        </p>
                      ) : jobError ? (
                        <p role="alert" className="text-sm text-rose-700">
                          {jobError}
                        </p>
                      ) : jobDetails[job.jobId] ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-slate-700">
                            {job.total} recipient(s)
                          </p>
                          <ul className="grid gap-2 sm:grid-cols-2">
                            {jobDetails[job.jobId].recipients.map(
                              (recipient, index) => (
                                <li
                                  key={`${recipient.recipient}-${index}`}
                                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                                >
                                  <span className="break-all text-slate-800">
                                    {recipient.recipient}
                                  </span>
                                  <span className="font-semibold capitalize text-slate-600">
                                    {recipient.status}
                                  </span>
                                  {recipient.error && (
                                    <span className="w-full text-xs text-rose-700">
                                      {recipient.error}
                                    </span>
                                  )}
                                </li>
                              ),
                            )}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  )}
                </article>
              ))}
              {dataJobsTruncated && (
                <p className="text-sm text-amber-800">
                  Showing the 100 most recent bulk jobs. Narrow the date range
                  or select an API key to see fewer results.
                </p>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
              No bulk send jobs found for these filters.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
