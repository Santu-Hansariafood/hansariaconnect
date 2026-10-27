"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { getTemplateVariableNames } from "@/lib/messageTemplates";

type CodeLanguage = "curl" | "JavaScript" | "Python" | "PHP";

const LANGUAGES: CodeLanguage[] = ["curl", "JavaScript", "Python", "PHP"];
const ENDPOINT = "https://hfconnect.in/api/v1/messages/send";
const TEST_ENDPOINT = "https://hfconnect.in/api/v1/connection/test";

const phpString = (value: string) =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export default function TemplateApiIntegrationExample({
  template,
  isPlatformAdmin,
}: {
  template: {
    _id: string;
    adminId: string;
    name: string;
    body: string;
    subject?: string;
    header?: string;
    footer?: string;
    translations?: Record<string, string>;
    defaultLanguage?: string;
    ownerUserId?: string;
  };
  isPlatformAdmin: boolean;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("JavaScript");
  const [apiKey, setApiKey] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const subject = template.subject || template.header || "";
  const variableNames = Array.from(
    new Set(
      [
        subject,
        template.body,
        template.footer || "",
        ...Object.values(template.translations || {}),
      ].flatMap(getTemplateVariableNames),
    ),
  );
  const values = Object.fromEntries(
    variableNames.map((name) => [name, `YOUR_${name.toUpperCase()}`]),
  );
  const valuesJson = JSON.stringify(values);
  const phpValues = Object.entries(values)
    .map(([name, value]) => `${phpString(name)} => ${phpString(value)}`)
    .join(", ");

  const connectionValues = `HANSARIA_API_URL=${ENDPOINT}
HANSARIA_API_KEY=${apiKey || "YOUR_API_KEY"}
HANSARIA_TEMPLATE_ID=${template._id}`;

  /*
   * The key alone is enough to prove the connection, so the default check is a
   * single line. `templateId` / `adminId` are appended only as an optional
   * deeper check.
   */
  const testCommand = `curl -H "Authorization: Bearer $HANSARIA_API_KEY" "${TEST_ENDPOINT}"`;
  const testCommandWithTemplate = `curl -H "Authorization: Bearer $HANSARIA_API_KEY" "${TEST_ENDPOINT}?templateId=${template._id}&adminId=${template.adminId}"`;

  const snippets: Record<CodeLanguage, string> = {
    curl: `curl -X POST "${ENDPOINT}" \\
  -H "Authorization: Bearer $HANSARIA_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "templateId": "${template._id}",
    "toUserId": "RECIPIENT_MOBILE",
    "variables": ${valuesJson}
  }'`,
    JavaScript: `const response = await fetch("${ENDPOINT}", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    templateId: "${template._id}",
    toUserId: "RECIPIENT_MOBILE",
    variables: ${valuesJson}
  })
});

const result = await response.json();
if (!response.ok) throw new Error(result.error);
console.log(result.message);`,
    Python: `import os
import requests

response = requests.post(
    "${ENDPOINT}",
    headers={"Authorization": "Bearer " + os.environ["HANSARIA_API_KEY"]},
    json={
        "templateId": "${template._id}",
        "toUserId": "RECIPIENT_MOBILE",
        "variables": ${valuesJson},
    },
    timeout=30,
)

print(response.json())`,
    PHP: `<?php
$payload = [
  "templateId" => ${phpString(template._id)},
  "toUserId" => "RECIPIENT_MOBILE",
  "variables" => [${phpValues}]
];

$ch = curl_init("${ENDPOINT}");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("HANSARIA_API_KEY"),
    "Content-Type: application/json"
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_RETURNTRANSFER => true
]);

echo curl_exec($ch);`,
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(`${label} copied.`);
    } catch {
      setCopyStatus("Copy failed. Select the text and copy it manually.");
    }
  };

  return (
    <details className="mt-3">
      <summary
        className={`cursor-pointer text-sm font-medium ${
          isPlatformAdmin ? "text-indigo-700" : "text-emerald-700"
        }`}
      >
        Copy this template into your app
      </summary>
      <div className="mt-3 space-y-4 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
        <div>
          <h4 className="font-semibold text-white">1. Connection values</h4>
          <p className="mt-1 leading-5 text-slate-300">
            Paste the API key you created for this workspace once. Everything
            else is already filled in from this template.
          </p>
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value.trim())}
            placeholder="Paste your API key"
            className="mt-2 w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-400"
          />
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3">
            <code>{connectionValues}</code>
          </pre>
          <button
            type="button"
            onClick={() => copy(connectionValues, "Connection values")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-300"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy connection values
          </button>
        </div>

        <div className="border-t border-white/15 pt-4">
          <h4 className="font-semibold text-white">2. Send a message</h4>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {LANGUAGES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLanguage(option)}
                className={`rounded-full px-3 py-1 font-medium ${
                  language === option
                    ? "bg-white text-slate-900"
                    : "border border-white/20 text-slate-200 hover:bg-white/10"
                }`}
              >
                {option}
              </button>
            ))}
            <button
              type="button"
              onClick={() => copy(snippets[language], `${language} example`)}
              className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-200"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <pre className="mt-2 max-h-[26rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
            <code>{snippets[language]}</code>
          </pre>
          <p className="mt-2 leading-5 text-slate-300">
            Replace <code>RECIPIENT_MOBILE</code> with the recipient&apos;s
            registered mobile number
            {variableNames.length
              ? ` and these values on every send: ${variableNames
                  .map((name) => `YOUR_${name.toUpperCase()}`)
                  .join(", ")}.`
              : ". This template has no values to fill in."}
          </p>
          <p className="mt-1 leading-5 text-slate-300">
            This sends an in-app chat message, not carrier SMS. Browsers are
            supported, but a key used in browser code is visible to your users,
            so use a dedicated key for that app.
          </p>
        </div>

        <div className="border-t border-white/15 pt-4">
          <h4 className="font-semibold text-white">
            Test the connection (sends nothing)
          </h4>
          <p className="mt-1 leading-5 text-slate-300">
            The API key is the only credential. Run this single line to confirm
            the connection — no workspace ID or template ID required.
          </p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
            <code>{testCommand}</code>
          </pre>
          <button
            type="button"
            onClick={() => copy(testCommand, "Test command")}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-200"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy test command
          </button>
          <p className="mt-3 leading-5 text-slate-300">
            Optional — append this template and workspace to also verify they
            belong to your key:
          </p>
          <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
            <code>{testCommandWithTemplate}</code>
          </pre>
          <p className="mt-1 leading-5 text-slate-300">
            Every response returns a <code>checks</code> object marking{" "}
            <code>ok</code>, <code>failed</code>, or <code>skipped</code> for{" "}
            <code>apiKey</code>, <code>request</code>, <code>sender</code>,{" "}
            <code>adminWorkspace</code>, and <code>template</code>; on failure{" "}
            <code>failedAt</code> names the step to fix.
          </p>
        </div>

        <p
          className="flex min-h-5 items-center gap-1.5 font-medium text-emerald-300"
          aria-live="polite"
        >
          {copyStatus ? <Check className="h-3.5 w-3.5" /> : null}
          {copyStatus}
        </p>
      </div>
    </details>
  );
}
