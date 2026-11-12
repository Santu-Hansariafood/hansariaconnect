"use client";

import { useEffect, useState } from "react";

type WebhookEvent = "message.created" | "message.status_changed";

const EVENT_LABELS: { value: WebhookEvent; label: string }[] = [
  { value: "message.created", label: "New messages" },
  { value: "message.status_changed", label: "Message delivery/read status changes" },
];

export default function WebhookSettings({
  adminId,
  isPlatformAdmin,
  workspaces,
}: {
  adminId: string;
  isPlatformAdmin: boolean;
  workspaces: { _id: string; userId: string }[];
}) {
  const [workspaceId, setWorkspaceId] = useState(adminId);
  const [url, setUrl] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>(
    EVENT_LABELS.map(({ value }) => value),
  );
  const [hasSecret, setHasSecret] = useState(false);
  const [signingSecret, setSigningSecret] = useState("");
  const [secretWorkspaceId, setSecretWorkspaceId] = useState("");
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loading = Boolean(workspaceId) && loadedWorkspaceId !== workspaceId;

  useEffect(() => {
    if (!workspaceId) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ adminId: workspaceId });
    void fetch(`/api/admin/webhooks?${query}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Failed to load webhook settings");
        if (controller.signal.aborted) return;
        setUrl(data.webhook.url);
        setEnabled(data.webhook.enabled);
        setEvents(data.webhook.events);
        setHasSecret(data.webhook.hasSecret);
        setLoadedWorkspaceId(workspaceId);
      })
      .catch((cause: unknown) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Failed to load webhook settings");
      })
      .finally(() => setLoadedWorkspaceId(workspaceId));
    return () => controller.abort();
  }, [workspaceId]);

  const save = async (rotateSecret: boolean) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/webhooks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminId: workspaceId, url, enabled, events, rotateSecret }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to save webhook settings");
      setHasSecret(data.webhook.hasSecret);
      setSigningSecret(data.signingSecret || "");
      setSecretWorkspaceId(data.signingSecret ? workspaceId : "");
      setNotice("Webhook settings saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save webhook settings");
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = (event: WebhookEvent) => {
    setEvents((current) =>
      current.includes(event)
        ? current.filter((value) => value !== event)
        : [...current, event],
    );
  };

  if (!workspaceId) {
    return (
      <section className="rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Outgoing webhooks</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Select an admin workspace to configure its webhook.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-700">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-slate-100">Connect another app with webhooks</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          HansariaConnect sends signed HTTPS events for messages sent through this workspace&apos;s API keys.
        </p>
      </div>

      {isPlatformAdmin && (
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Admin workspace
          <select
            value={workspaceId}
            onChange={(event) => {
              setWorkspaceId(event.target.value);
              setSigningSecret("");
              setError("");
              setNotice("");
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            {workspaces.map((workspace) => (
              <option key={workspace._id} value={workspace._id}>
                {workspace.userId}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          {notice}
        </p>
      )}

      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        HTTPS endpoint URL
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://your-app.example.com/webhooks/hansaria"
          maxLength={2048}
          disabled={loading}
          className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          disabled={loading}
          className="size-4 accent-emerald-700"
        />
        Enable webhook delivery
      </label>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          Events
        </legend>
        {EVENT_LABELS.map(({ value, label }) => (
          <label key={value} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={events.includes(value)}
              onChange={() => toggleEvent(value)}
              disabled={loading}
              className="size-4 accent-emerald-700"
            />
            {label}
          </label>
        ))}
      </fieldset>

      {signingSecret && secretWorkspaceId === workspaceId ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Copy the signing secret now. It will not be shown again.
          </p>
          <code className="mt-2 block break-all text-xs text-amber-950 dark:text-amber-100">
            {signingSecret}
          </code>
        </div>
      ) : hasSecret ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          A signing secret is configured. Rotate it to view a new secret.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save(false)}
          disabled={saving || loading || !url.trim()}
          className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save webhook"}
        </button>
        <button
          type="button"
          onClick={() => void save(true)}
          disabled={saving || loading || !url.trim()}
          className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Rotate signing secret
        </button>
      </div>
    </section>
  );
}
