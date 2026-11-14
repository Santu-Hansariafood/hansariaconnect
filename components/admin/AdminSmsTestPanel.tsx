"use client";

import { useState, type FormEvent } from "react";

type SmsTestResult = {
  recipient: string;
  status: string;
  accepted: boolean;
  messageId?: string;
  error?: string;
};

const testMessage =
  "HansariaConnect SMS test. If you received this, SMS sending is working.";

export default function AdminSmsTestPanel() {
  const [numbers, setNumbers] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [results, setResults] = useState<SmsTestResult[]>([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const sendTest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setResults([]);

    const recipients = numbers
      .split(/[\n,;]+/)
      .map((number) => number.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setError("Enter at least one phone number.");
      return;
    }
    if (recipients.length > 10) {
      setError("You can test up to 10 numbers at a time.");
      return;
    }
    if (!confirmed) {
      setError("Confirm that each recipient agreed to receive this test SMS.");
      return;
    }

    setSending(true);
    try {
      const response = await fetch("/api/admin/sms-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipients, consent: true }),
      });
      const data = (await response.json().catch(() => null)) as
        | { error?: string; results?: SmsTestResult[] }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || `SMS test failed (${response.status}).`);
      }
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not send the SMS test.",
      );
    } finally {
      setSending(false);
    }
  };

  const acceptedCount = results.filter((result) => result.accepted).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-800 dark:text-emerald-300">
          Messaging
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
          SMS delivery test
        </h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-400">
          Send a test SMS to one or more numbers and see the provider result for
          each. Enter one number per line, or separate numbers with commas or
          semicolons. Indian 10-digit numbers are sent with +91; international
          numbers must use E.164 format. Up to 10 numbers per test.
        </p>
      </div>

      <form onSubmit={sendTest} className="mt-5 space-y-4">
        <label className="grid gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          Recipient phone numbers
          <textarea
            value={numbers}
            onChange={(event) => setNumbers(event.target.value)}
            rows={4}
            maxLength={400}
            placeholder={"9876543210\n+14155550123"}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-normal text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            required
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Test message
          </p>
          <p className="mt-2 text-sm text-slate-800 dark:text-slate-100">
            {testMessage}
          </p>
        </div>

        <label className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-200">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
          />
          <span>
            I confirm these recipients agreed to receive this test SMS.
          </span>
        </label>

        <button
          type="submit"
          disabled={sending || !confirmed}
          className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? "Sending test..." : "Send test SMS"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-900/25 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {acceptedCount} of {results.length} SMS request(s) accepted by
            Twilio
          </p>
          <ul className="space-y-2">
            {results.map((result, index) => (
              <li
                key={`${result.recipient}-${index}`}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all text-sm font-medium text-slate-800 dark:text-slate-100">
                    {result.recipient}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      result.accepted
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                    }`}
                  >
                    {result.accepted
                      ? `Accepted · ${result.status}`
                      : result.status}
                  </span>
                </div>
                {result.error && (
                  <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
                    {result.error}
                  </p>
                )}
                {result.messageId && (
                  <p className="mt-2 break-all text-xs text-slate-500 dark:text-slate-400">
                    Provider message ID: {result.messageId}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
        “Accepted” means Twilio accepted the request. This immediate test
        cannot confirm final carrier delivery. Each admin may send up to 3
        test batches per hour, and a recipient can be tested once per hour.
      </p>
    </section>
  );
}
