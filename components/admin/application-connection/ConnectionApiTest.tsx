"use client";

import { useState } from "react";

type WorkspaceApiKey = {
  _id: string;
  name: string;
  isActive: boolean;
  isPrimary: boolean;
  permissions: { sendMessage: boolean };
  expiresAt?: string;
  isExpired?: boolean;
  senderUserId?: string;
};

type ConnectionApiTestProps = {
  adminId: string;
  apiKeys: WorkspaceApiKey[];
  onKeyCreated: () => void;
};

const sampleMessage = "Hello, I am from Hansaria Connect.";

type RecipientResult = {
  recipient: string;
  success: boolean;
  messageId?: string;
  error?: string;
};

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
  apiKeys,
  onKeyCreated,
}: ConnectionApiTestProps) {
  const [apiKey, setApiKey] = useState("");
  const [senderUserId, setSenderUserId] = useState("");
  const [selectedApiKeyId, setSelectedApiKeyId] = useState("");
  const [recipientInput, setRecipientInput] = useState("");
  const [recipientResults, setRecipientResults] = useState<RecipientResult[]>([]);
  const [busy, setBusy] = useState<"key" | "send" | null>(null);
  const [testKeyCreated, setTestKeyCreated] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [keyCopyStatus, setKeyCopyStatus] = useState("");
  const activeSendKeys = apiKeys.filter(
    (key) =>
      key.isActive &&
      !key.isExpired &&
      key.permissions.sendMessage,
  );
  const effectiveSelectedApiKeyId =
    selectedApiKeyId ||
    (activeSendKeys.length === 1 ? activeSendKeys[0]._id : "");
  const selectedApiKey = activeSendKeys.find(
    (key) => key._id === effectiveSelectedApiKeyId,
  );

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
        apiKey?: { _id?: string; key?: string };
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || `Key request failed: ${response.status}`);
      }
      if (!result?.apiKey?._id || !result.apiKey.key) {
        throw new Error("The key was created, but the secret was not returned.");
      }
      setApiKey(result.apiKey.key);
      setSelectedApiKeyId(result.apiKey._id);
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
      setError(
        effectiveSelectedApiKeyId
          ? "Paste the secret for the selected active key, or create a new test key."
          : "Select an active key or create a new test key.",
      );
      return;
    }
    if (!effectiveSelectedApiKeyId) {
      setError("Select the active key that matches the key entered above.");
      return;
    }
    if (!senderUserId.trim()) {
      setError("Enter the sender's existing chat account ID.");
      return;
    }
    const recipients = recipientInput
      .split(/[\n,;]+/)
      .map((recipient) => recipient.trim())
      .filter(Boolean);
    if (!recipients.length) {
      setError("Enter at least one recipient's mobile number or chat account ID.");
      return;
    }
    if (recipients.length > 10) {
      setError("You can test up to 10 recipients at a time.");
      return;
    }

    setBusy("send");
    setError("");
    setStatus("");
    setRecipientResults([]);
    const results: RecipientResult[] = [];
    try {
      for (const recipient of Array.from(new Set(recipients))) {
        try {
          const response = await fetch("/api/v1/messages/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey.trim()}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              fromUserId: senderUserId.trim(),
              toUserId: recipient,
              text: sampleMessage,
              expectedApiKeyId: effectiveSelectedApiKeyId,
            }),
          });
          const result = (await response.json().catch(() => null)) as {
            success?: boolean;
            error?: string;
            message?: { id?: string };
          } | null;
          if (!response.ok || !result?.success) {
            results.push({
              recipient,
              success: false,
              error:
                result?.error || `Message request failed: ${response.status}`,
            });
          } else {
            results.push({
              recipient,
              success: true,
              messageId: result.message?.id,
            });
          }
        } catch (cause: unknown) {
          results.push({
            recipient,
            success: false,
            error:
              cause instanceof Error
                ? cause.message
                : "Failed to send the test message.",
          });
        }
      }
    } finally {
      setRecipientResults(results);
      const sentCount = results.filter((result) => result.success).length;
      setStatus(
        `${sentCount} of ${results.length} in-app chat message(s) created. Check each recipient's chat; this does not send carrier SMS.`,
      );
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
          Test in-app chat delivery
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Send the sample through HansariaConnect chat, not carrier SMS. Select
          an active send key for this workspace, or create a short-lived test
          key that is selected automatically. Existing key secrets are shown
          only once, so paste that key&apos;s secret if you choose an existing
          key. Use already registered recipients; there is no need to register
          them again.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Active workspace API key
          <select
            value={effectiveSelectedApiKeyId}
            onChange={(event) => {
              const nextKey = activeSendKeys.find(
                (key) => key._id === event.target.value,
              );
              setSelectedApiKeyId(event.target.value);
              setApiKey("");
              setTestKeyCreated(false);
              setKeyCopyStatus("");
              setSenderUserId(nextKey?.senderUserId || "");
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select an active key</option>
            {activeSendKeys.map((key) => (
              <option key={key._id} value={key._id}>
                {key.name}
                {key.isPrimary ? " - Primary" : ""}
                {` - ID ${key._id.slice(-6)}`}
                {key.expiresAt
                  ? ` - expires ${new Date(key.expiresAt).toLocaleDateString()}`
                  : " - no expiry"}
              </option>
            ))}
            {testKeyCreated &&
              selectedApiKeyId &&
              !activeSendKeys.some(
                (key) => key._id === selectedApiKeyId,
              ) && (
                <option value={selectedApiKeyId}>
                  Temporary test key - just created
                </option>
              )}
          </select>
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {activeSendKeys.length
              ? "Choose the key whose secret you are using. The ID suffix and primary label help distinguish keys."
              : "No active send-enabled keys found in this workspace. Create a temporary test key below."}
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Sender chat account ID
          <input
            value={senderUserId}
            onChange={(event) => setSenderUserId(event.target.value)}
            disabled={testKeyCreated || Boolean(selectedApiKey?.senderUserId)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder="Existing account's 24-character ID"
          />
          {testKeyCreated && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              This test key is bound to the sender shown here.
            </span>
          )}
          {!testKeyCreated && selectedApiKey?.senderUserId && (
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              This key is bound to the sender shown here.
            </span>
          )}
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Recipient mobile numbers or chat account IDs
          <textarea
            value={recipientInput}
            onChange={(event) => setRecipientInput(event.target.value)}
            rows={3}
            maxLength={400}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            placeholder={"Registered mobile or account ID, one per line"}
          />
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            Separate recipients with a new line, comma, or semicolon. Up to 10
            per test. The API finds registered accounts automatically; new
            recipients must be onboarded first.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 dark:text-slate-200 sm:col-span-2">
          Workspace API key
          <span className="flex flex-wrap gap-2">
            <input
              type="text"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value.trim())}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              placeholder={
                effectiveSelectedApiKeyId
                  ? "Paste the selected key's secret, or create a test key"
                  : "Select an active key or create a test key"
              }
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
          <span aria-live="polite" className="min-h-4 text-xs font-normal text-slate-500 dark:text-slate-400">
            {keyCopyStatus ||
              (testKeyCreated
                ? "The generated key is already selected for sending; no paste is needed."
                : effectiveSelectedApiKeyId
                  ? "Existing keys are selected by name, but their secret must be pasted because it cannot be retrieved."
                  : "Select an active key and paste its secret, or create a 24-hour key below to fill this automatically.")}
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
              : "Create and use 24-hour test key"}
        </button>
        <button
          type="button"
          onClick={sendTestMessage}
          disabled={busy !== null}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {busy === "send" ? "Sending..." : "Send sample chat message(s)"}
        </button>
        <span
          aria-live="polite"
          className={`text-sm ${error ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {error || status}
        </span>
      </div>

      {recipientResults.length > 0 && (
        <ul className="mt-4 space-y-2">
          {recipientResults.map((result, index) => (
            <li
              key={`${result.recipient}-${index}`}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="break-all text-slate-800 dark:text-slate-100">
                  {result.recipient}
                </span>
                <span
                  className={
                    result.success
                      ? "font-semibold text-emerald-700 dark:text-emerald-300"
                      : "font-semibold text-red-700 dark:text-red-300"
                  }
                >
                  {result.success ? "Created in chat" : "Failed"}
                </span>
              </div>
              {result.error && (
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  {result.error}
                </p>
              )}
              {result.messageId && (
                <p className="mt-1 break-all text-xs text-slate-500 dark:text-slate-400">
                  Message ID: {result.messageId}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

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
