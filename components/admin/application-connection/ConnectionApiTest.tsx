"use client";

import { useState } from "react";

type ConnectionApiTestProps = {
  adminId: string;
  onKeyCreated: () => void;
};

const sampleMessage = "Hello, I am from Hansaria Connect.";

const requestTemplate = `curl -X POST "https://hfconnect.in/api/v1/messages/send" \\
  -H "Authorization: Bearer $HANSARIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fromUserId": "SENDER_CHAT_ACCOUNT_ID",
    "toUserId": "REGISTERED_RECIPIENT_MOBILE_OR_CHAT_ACCOUNT_ID",
    "text": "${sampleMessage}"
  }'`;

export default function ConnectionApiTest({
  adminId,
  onKeyCreated,
}: ConnectionApiTestProps) {
  const [apiKey, setApiKey] = useState("");
  const [senderUserId, setSenderUserId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState<"key" | "send" | null>(null);
  const [testKeyCreated, setTestKeyCreated] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [keyCopyStatus, setKeyCopyStatus] = useState("");

  const createTestKey = async () => {
    if (!senderUserId.trim()) {
      setError("Enter the sender's existing chat account ID before creating a test key.");
      return;
    }
    setBusy("key");
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Connection test (24 hours)",
          adminId,
          senderUserId: senderUserId.trim(),
          testOnly: true,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        apiKey?: { key?: string };
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || `Key request failed: ${response.status}`);
      }
      if (!result?.apiKey?.key) {
        throw new Error("The key was created, but the secret was not returned.");
      }
      setApiKey(result.apiKey.key);
      setTestKeyCreated(true);
      setStatus(
        "A send-only key bound to this sender was created for this workspace. It expires in 24 hours; copy it now because it cannot be shown again.",
      );
      onKeyCreated();
    } catch (cause: unknown) {
      console.error("[admin] Failed to create connection test key:", cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to create a connection test key.",
      );
    } finally {
      setBusy(null);
    }
  };

  const sendTestMessage = async () => {
    if (!apiKey.trim()) {
      setError("Create a test key or paste an API key for this workspace.");
      return;
    }
    if (!senderUserId.trim()) {
      setError("Enter the sender's existing chat account ID.");
      return;
    }
    if (!recipient.trim()) {
      setError("Enter a recipient's mobile number or chat account ID.");
      return;
    }

    setBusy("send");
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/v1/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fromUserId: senderUserId.trim(),
          toUserId: recipient.trim(),
          text: sampleMessage,
        }),
      });
      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || `Message request failed: ${response.status}`);
      }
      setStatus("Test message sent. Check the recipient's chat to confirm delivery.");
    } catch (cause: unknown) {
      console.error("[admin] Connection test message failed:", cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "Failed to send the test message.",
      );
    } finally {
      setBusy(null);
    }
  };

  const copyRequestTemplate = async () => {
    try {
      await navigator.clipboard.writeText(requestTemplate);
      setCopyStatus("Request template copied.");
    } catch {
      setCopyStatus("Copy failed. Select the request and copy it manually.");
    }
  };

  const copyApiKey = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setKeyCopyStatus("Key copied.");
    } catch {
      setKeyCopyStatus("Copy failed. Select the key field and copy it manually.");
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">
          Test your API connection
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Create a short-lived, send-only key for this workspace or paste an
          existing workspace key. The sample sends only after you press the
          button below. Use an existing user&apos;s registered mobile number
          or chat account ID; there is no need to register that user again.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Sender chat account ID
          <input
            value={senderUserId}
            onChange={(event) => setSenderUserId(event.target.value)}
            disabled={testKeyCreated}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Existing account's 24-character ID"
          />
          {testKeyCreated && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              This test key is bound to the sender shown here.
            </span>
          )}
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Recipient mobile or chat account ID
          <input
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Registered user's mobile or account ID"
          />
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            The API finds an existing account automatically. New recipients
            must be onboarded before they can receive in-app messages.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Workspace API key
          <span className="flex flex-wrap gap-2">
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value.trim())}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder="Paste the key shown when it was created"
            />
            <button
              type="button"
              onClick={copyApiKey}
              disabled={!apiKey}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
            >
              Copy key
            </button>
          </span>
          <span aria-live="polite" className="min-h-4 text-xs font-normal text-slate-500">
            {keyCopyStatus}
          </span>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={createTestKey}
          disabled={
            busy !== null ||
            !adminId ||
            testKeyCreated ||
            Boolean(apiKey.trim())
          }
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
        >
          {busy === "key"
            ? "Creating key..."
            : testKeyCreated
              ? "Test key created"
              : "Create 24-hour test key"}
        </button>
        <button
          type="button"
          onClick={sendTestMessage}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busy === "send" ? "Sending..." : "Send sample message"}
        </button>
        <span
          aria-live="polite"
          className={`text-sm ${error ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {error || status}
        </span>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
        New test keys are workspace-scoped, bound to the sender above,
        send-only, expire after 24 hours, and are shown only once. The entered
        key stays in this page&apos;s temporary state and is not saved by
        HansariaConnect. It still uses one of the workspace&apos;s three key
        slots, so delete it from API key settings after testing.
      </p>

      <div className="mt-4 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-semibold text-white">Sample request template</h4>
          <button
            type="button"
            onClick={copyRequestTemplate}
            className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-200"
          >
            Copy request
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
          <code>{requestTemplate}</code>
        </pre>
        <p aria-live="polite" className="mt-2 min-h-5 text-slate-300">
          {copyStatus}
        </p>
      </div>
    </section>
  );
}
