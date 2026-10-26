"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, Phone, Reply, Send } from "lucide-react";
import {
  getTemplateVariableNames,
  renderMessageTemplate,
} from "@/lib/messageTemplates";
import { getLocalizedTemplateText } from "@/lib/templateTranslations";
import type { BuilderTemplate } from "./types";

type SendResult = { ok: boolean; text: string };

const API_BASE_URL = "https://hfconnect.in";

const buttonIcon = { call: Phone, reply: Reply, confirm: Check };

export default function WhatsAppTemplateBuilder({
  templates,
  isPlatformAdmin,
  onCreateTemplate,
}: {
  templates: BuilderTemplate[];
  isPlatformAdmin: boolean;
  onCreateTemplate: () => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [language, setLanguage] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [recipient, setRecipient] = useState("");
  const [recipientMode, setRecipientMode] = useState<"single" | "multiple">(
    "single",
  );
  const [apiKey, setApiKey] = useState("");
  const [senderUserId, setSenderUserId] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [clockTime, setClockTime] = useState("");

  const accent = isPlatformAdmin ? "text-indigo-700" : "text-emerald-700";
  const accentSolid = isPlatformAdmin ? "bg-indigo-700" : "bg-emerald-700";
  const accentSoft = isPlatformAdmin
    ? "border-indigo-200 bg-indigo-50"
    : "border-emerald-200 bg-emerald-50";

  useEffect(() => {
    const update = () =>
      setClockTime(
        new Date()
          .toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
          .toLowerCase(),
      );
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const template =
    templates.find((item) => item._id === selectedTemplateId) || templates[0];

  const languages = useMemo(
    () =>
      template
        ? Array.from(
            new Set([
              template.defaultLanguage || "en",
              ...Object.keys(template.translations || {}),
            ]),
          )
        : [],
    [template],
  );
  const activeLanguage = languages.includes(language)
    ? language
    : languages[0] || "en";

  const headerText = template?.subject || template?.header || "";
  const bodyText = template
    ? getLocalizedTemplateText(template.body, template.translations, activeLanguage)
    : "";
  const footerText = template?.footer || "";

  const variableNames = useMemo(
    () => getTemplateVariableNames([headerText, bodyText, footerText].join("\n")),
    [headerText, bodyText, footerText],
  );

  const values = useMemo(() => {
    if (!template) return {};
    return Object.fromEntries(
      variableNames.map((name) => [
        name,
        sampleValues[`${template._id}:${name}`] || `Example ${name}`,
      ]),
    );
  }, [template, variableNames, sampleValues]);

  const renderedHeader = renderMessageTemplate(headerText, values).text;
  const renderedBody = renderMessageTemplate(bodyText, values).text;
  const renderedFooter = renderMessageTemplate(footerText, values).text;
  const recipients = recipient
    .split(/[,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const payload = template
    ? {
        adminId: template.adminId,
        templateId: template._id,
        language: activeLanguage,
        toUserId: recipient.trim() || "RECIPIENT_CHAT_ACCOUNT_ID",
        ...(senderUserId.trim() ? { fromUserId: senderUserId.trim() } : {}),
        variables: values,
      }
    : null;
  const requestExample =
    payload === null
      ? ""
      : `curl -X POST "${API_BASE_URL}/api/v1/messages/send" \\
  -H "Authorization: Bearer $HANSARIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(payload, null, 2)}'`;

  const activeRequestExample =
    recipientMode === "single" || payload === null
      ? requestExample
      : requestExample
          .replace("/api/v1/messages/send", "/api/v1/messages/bulk")
          .replace(
            JSON.stringify(payload, null, 2),
            JSON.stringify(
              {
                adminId: template.adminId,
                templateId: template._id,
                ...(senderUserId.trim()
                  ? { fromUserId: senderUserId.trim() }
                  : {}),
                recipients: (recipients.length
                  ? recipients
                  : ["RECIPIENT_MOBILE"]
                ).map((toUserId) => ({
                  toUserId,
                  language: activeLanguage,
                  variables: values,
                })),
              },
              null,
              2,
            ),
          );

  const copyRequest = async () => {
    try {
      await navigator.clipboard.writeText(activeRequestExample);
      setCopyStatus("Request copied.");
    } catch {
      setCopyStatus("Copy failed. Select the request and copy it manually.");
    }
  };

  const sendTestMessage = async () => {
    if (!template || !payload) return;
    if (!recipients.length) {
      setSendResult({
        ok: false,
        text:
          recipientMode === "single"
            ? "Enter the recipient's mobile number or chat account ID."
            : "Enter at least one recipient mobile number or chat account ID.",
      });
      return;
    }
    if (recipientMode === "multiple" && recipients.length > 1000) {
      setSendResult({
        ok: false,
        text: "You can send to a maximum of 1,000 recipients at a time.",
      });
      return;
    }
    if (!apiKey.trim()) {
      setSendResult({
        ok: false,
        text: "Paste an API key created for this workspace.",
      });
      return;
    }
    setIsSending(true);
    setSendResult(null);
    try {
      const requestPayload =
        recipientMode === "single"
          ? payload
          : {
              adminId: template.adminId,
              templateId: template._id,
              ...(senderUserId.trim()
                ? { fromUserId: senderUserId.trim() }
                : {}),
              recipients: recipients.map((toUserId) => ({
                toUserId,
                language: activeLanguage,
                variables: values,
              })),
            };
      const response = await fetch(
        `/api/v1/messages/${recipientMode === "single" ? "send" : "bulk"}`,
        {
          method: "POST",
          headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
          },
          body: JSON.stringify(requestPayload),
        },
      );
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        message?: unknown;
        jobId?: string;
        statusUrl?: string;
      } | null;
      if (!response.ok) {
        throw new Error(result?.error || `Request failed: ${response.status}`);
      }
      setSendResult({
        ok: true,
        text:
          recipientMode === "single"
            ? "Test message sent. Open the chat account to confirm it arrived."
            : `Queued ${recipients.length} recipient(s). Job ID: ${result?.jobId || "unknown"}. Check ${result?.statusUrl || "the bulk job status endpoint"} for progress.`,
      });
    } catch (error: unknown) {
      console.error("[admin] Template test send failed:", error);
      setSendResult({
        ok: false,
        text:
          error instanceof Error
            ? error.message
            : "Failed to send the test message.",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!template) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-900">
          Template message builder
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Create a template first. A template holds the header, body, footer, and
          buttons your other app sends.
        </p>
        <button
          type="button"
          onClick={onCreateTemplate}
          className={`mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white ${accentSolid}`}
        >
          Open templates
        </button>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-900">Template message builder</h3>
      <p className="mt-1 text-sm leading-6 text-slate-600">
        Pick a template, fill the sample values, and preview the exact message
        your other app will deliver. Send a test before wiring your code.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Template
          <select
            value={template._id}
            onChange={(event) => setSelectedTemplateId(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
          >
            {templates.map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Language
          <select
            value={activeLanguage}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
          >
            {languages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {variableNames.length ? (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-slate-900">
            Sample values
          </h4>
          <p className="mt-1 text-xs text-slate-500">
            Your other app replaces each placeholder with real data when it
            sends.
          </p>
          <div className="mt-2 grid gap-2">
            {variableNames.map((name) => (
              <label
                key={name}
                className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2"
              >
                <code
                  className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${accentSoft} ${accent}`}
                >{`{{${name}}}`}</code>
                <input
                  value={sampleValues[`${template._id}:${name}`] ?? ""}
                  onChange={(event) =>
                    setSampleValues((previous) => ({
                      ...previous,
                      [`${template._id}:${name}`]: event.target.value,
                    }))
                  }
                  placeholder={`Example ${name}`}
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
                />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          This template has no placeholders.
        </p>
      )}

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-900">Preview</h4>
        <div className="mt-2 rounded-2xl bg-[#efeae2] p-4">
          <div className="mx-auto max-w-sm">
            <div className="rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 shadow-sm">
              {renderedHeader && (
                <p className="text-[15px] font-semibold text-[#111b21]">
                  {renderedHeader}
                </p>
              )}
              {renderedBody && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6 text-[#111b21]">
                  {renderedBody}
                </p>
              )}
              {renderedFooter && (
                <p className="mt-1 text-xs text-[#667781]">{renderedFooter}</p>
              )}
              <p className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781]">
                {clockTime}
                <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
              </p>
            </div>
            {Boolean(template.buttons?.length) && (
              <div className="mt-1 grid gap-px overflow-hidden rounded-xl bg-[#e9edef]">
                {template.buttons?.map((button, index) => {
                  const Icon = buttonIcon[button.type];
                  return (
                    <span
                      key={`${button.type}-${index}`}
                      className="flex items-center justify-center gap-2 bg-white py-2 text-sm font-medium text-[#00a884]"
                    >
                      <Icon className="h-4 w-4" />
                      {button.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="font-semibold text-white">
            Send this from your other app
          </h4>
          <button
            type="button"
            onClick={copyRequest}
            className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-200"
          >
            Copy request
          </button>
        </div>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
          <code>{activeRequestExample}</code>
        </pre>
        <p className="mt-2 min-h-5 text-slate-300" aria-live="polite">
          {copyStatus}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Recipients
          <select
            value={recipientMode}
            onChange={(event) =>
              setRecipientMode(
                event.target.value === "multiple" ? "multiple" : "single",
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
          >
            <option value="single">One recipient</option>
            <option value="multiple">Multiple recipients</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          {recipientMode === "single"
            ? "Recipient mobile or chat account ID"
            : `Recipient mobile numbers or chat account IDs (${recipients.length})`}
          {recipientMode === "single" ? (
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              placeholder="e.g. 9876543210"
            />
          ) : (
            <textarea
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              rows={3}
              className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
              placeholder={"9876543210, 9876543211\n9876543212"}
            />
          )}
          {recipientMode === "multiple" && (
            <span className="text-xs font-normal text-slate-500">
              Separate recipients with commas or new lines (up to 1,000).
              Numbers are matched to existing HansariaConnect accounts
              automatically; no manual registration is needed here.
            </span>
          )}
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          Sender chat account ID (required unless already bound to the API key)
          <input
            value={senderUserId}
            onChange={(event) => setSenderUserId(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            placeholder="Existing account's 24-character ID"
          />
          <span className="text-xs font-normal text-slate-500">
            Use an existing HansariaConnect user account ID, not the workspace
            adminId or a phone number. You can also bind the sender to the API
            key and leave this blank.
          </span>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700 sm:col-span-2">
          Workspace API key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value.trim())}
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
            placeholder="Paste the key shown when you created it"
          />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={sendTestMessage}
          disabled={isSending}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${accentSolid}`}
        >
          <Send className="h-4 w-4" />
          {isSending ? "Sending..." : "Send test message"}
        </button>
        <span
          aria-live="polite"
          className={`text-sm ${sendResult?.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {sendResult?.text}
        </span>
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        The key is used in this page only and is never saved by
        HansariaConnect.
      </p>
    </section>
  );
}
