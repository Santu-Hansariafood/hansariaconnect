"use client";

import { useState } from "react";
import { getTemplateVariableNames } from "@/lib/messageTemplates";

type CodeLanguage = "JavaScript" | "Python" | "PHP";

const phpString = (value: string) =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

export default function TemplateApiIntegrationExample({
  template,
  isPlatformAdmin,
  adminUserId,
}: {
  template: {
    _id: string;
    name: string;
    body: string;
    header?: string;
    footer?: string;
    translations?: Record<string, string>;
    defaultLanguage?: string;
    ownerUserId?: string;
  };
  isPlatformAdmin: boolean;
  adminUserId: string;
}) {
  const [language, setLanguage] = useState<CodeLanguage>("JavaScript");
  const [copyStatus, setCopyStatus] = useState("");
  const [environmentCopyStatus, setEnvironmentCopyStatus] = useState("");
  const variableNames = Array.from(
    new Set(
      [
        template.header || "",
        template.body,
        template.footer || "",
        ...Object.values(template.translations || {}),
      ].flatMap(getTemplateVariableNames),
    ),
  );
  const variables = Object.fromEntries(
    variableNames.map((name) => [name, `YOUR_${name.toUpperCase()}`]),
  );
  const phpVariables = Object.entries(variables)
    .map(([name, value]) => `    ${phpString(name)} => ${phpString(value)}`)
    .join(",\n");

  const examples: Record<CodeLanguage, string> = {
    JavaScript: `const response = await fetch("https://hfconnect.in/api/v1/messages/send", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    adminUserId: process.env.HANSARIA_ADMIN_ID,
    adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
    templateName: ${JSON.stringify(template.name)},
    language: ${JSON.stringify(template.defaultLanguage || "en")},
    toUserId: "RECIPIENT_CHAT_ACCOUNT_ID",
    variables: ${JSON.stringify(variables, null, 2)}
  })
});

const result = await response.json();
if (!response.ok) {
  throw new Error(result.error || \`Request failed: \${response.status}\`);
}
console.log("Message sent", result);`,
    Python: `import os
import requests

response = requests.post(
    "https://hfconnect.in/api/v1/messages/send",
    headers={
        "Authorization": "Bearer " + os.environ["HANSARIA_API_KEY"],
        "Content-Type": "application/json",
    },
    json={
        "adminUserId": os.environ["HANSARIA_ADMIN_ID"],
        "adminPassword": os.environ["HANSARIA_ADMIN_PASSWORD"],
        "templateName": ${JSON.stringify(template.name)},
        "language": ${JSON.stringify(template.defaultLanguage || "en")},
        "toUserId": "RECIPIENT_CHAT_ACCOUNT_ID",
        "variables": ${JSON.stringify(variables, null, 2)},
    },
    timeout=30,
)

if not response.ok:
    raise RuntimeError(response.json().get("error", f"HTTP {response.status_code}"))
print("Message sent", response.json())`,
    PHP: `<?php
$payload = [
  "adminUserId" => getenv("HANSARIA_ADMIN_ID"),
  "adminPassword" => getenv("HANSARIA_ADMIN_PASSWORD"),
  "templateName" => ${phpString(template.name)},
  "language" => ${phpString(template.defaultLanguage || "en")},
  "toUserId" => "RECIPIENT_CHAT_ACCOUNT_ID",
  "variables" => [
${phpVariables}
  ]
];

$ch = curl_init("https://hfconnect.in/api/v1/messages/send");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("HANSARIA_API_KEY"),
    "Content-Type: application/json"
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_RETURNTRANSFER => true
]);
$body = curl_exec($ch);
if ($body === false) {
  throw new RuntimeException(curl_error($ch));
}
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
$result = json_decode($body, true);
if ($status < 200 || $status >= 300) {
  throw new RuntimeException($result["error"] ?? "HTTP " . $status);
}
echo "Message sent";`,
  };
  const example = examples[language];
  const environmentExample = `HANSARIA_API_BASE_URL=https://hfconnect.in
HANSARIA_API_KEY=paste-your-api-key-here
HANSARIA_ADMIN_ID=${template.ownerUserId || adminUserId}
HANSARIA_ADMIN_PASSWORD=paste-that-admins-password-here
HANSARIA_RATE_TEMPLATE_ID=${template._id}
HANSARIA_RATE_TO_USER_ID=paste-recipient-chat-account-id-here`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopyStatus("Code copied.");
    } catch {
      setCopyStatus("Copy failed. Select the code and copy it manually.");
    }
  };

  const copyEnvironment = async () => {
    try {
      await navigator.clipboard.writeText(environmentExample);
      setEnvironmentCopyStatus("Environment configuration copied.");
    } catch {
      setEnvironmentCopyStatus(
        "Copy failed. Select the configuration and copy it manually.",
      );
    }
  };

  return (
    <details className="mt-3">
      <summary
        className={`cursor-pointer text-sm font-medium ${
          isPlatformAdmin ? "text-indigo-700" : "text-emerald-700"
        }`}
      >
        API integration example
      </summary>
      <div className="mt-3 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
        <p className="mb-3 leading-5">
          This example uses the saved template name{" "}
          <code className="rounded bg-white/10 px-1">{template.name}</code>.
          Supply each listed variable. Run it on your server and keep all
          credentials secret. Configured Call, Reply, and Confirm buttons are
          included automatically when the saved template is sent.
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2">
            Programming language
            <select
              value={language}
              onChange={(event) => {
                const value = event.target.value;
                if (
                  value === "JavaScript" ||
                  value === "Python" ||
                  value === "PHP"
                ) {
                  setLanguage(value);
                }
              }}
              className="rounded-md border border-white/20 bg-slate-800 px-2 py-1.5 text-white"
            >
              <option>JavaScript</option>
              <option>Python</option>
              <option>PHP</option>
            </select>
          </label>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-md bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-200"
          >
            Copy code
          </button>
        </div>
        <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
          <code>{example}</code>
        </pre>
        <p className="mt-2 min-h-5 text-slate-300" aria-live="polite">
          {copyStatus}
        </p>
        <p className="mt-2 leading-5 text-slate-300">
          Add <code>HANSARIA_API_KEY</code>, <code>HANSARIA_ADMIN_ID</code>, and{" "}
          <code>HANSARIA_ADMIN_PASSWORD</code> as server-only environment
          variables. Replace <code>RECIPIENT_CHAT_ACCOUNT_ID</code> and
          the{" "}
          {variableNames.length
            ? variableNames.map((name) => `YOUR_${name.toUpperCase()}`).join(", ")
            : "no template variables"}{" "}
          values. For a bound API key, the sender is selected automatically.
        </p>
        <div className="mt-5 border-t border-white/15 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-white">
                Rate notification .env
              </h3>
              <p className="mt-1 leading-5 text-slate-300">
                Template ID and admin login are filled from this saved
                template. Add the key, password, and recipient ID on your
                other app&apos;s server.
              </p>
            </div>
            <button
              type="button"
              onClick={copyEnvironment}
              className="rounded-md bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-300"
            >
              Copy .env settings
            </button>
          </div>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3">
            <code>{environmentExample}</code>
          </pre>
          <p className="mt-2 min-h-5 text-slate-300" aria-live="polite">
            {environmentCopyStatus}
          </p>
          <p className="mt-1 leading-5 text-amber-200">
            Create an API key under Admin → API Keys and copy its secret when
            shown. The key is only displayed once. Use the chat account ID
            (MongoDB ObjectId) for the recipient, not an email address.
          </p>
        </div>
      </div>
    </details>
  );
}
