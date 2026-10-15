"use client";

import { useState } from "react";
import { getTemplateVariableNames } from "@/lib/messageTemplates";

type CodeLanguage = "JavaScript" | "Python" | "PHP";

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
  const [copyStatus, setCopyStatus] = useState("");
  const [environmentCopyStatus, setEnvironmentCopyStatus] = useState("");
  const [apiKey, setApiKey] = useState("");
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
    adminId: process.env.HANSARIA_ADMIN_ID,
    templateId: process.env.HANSARIA_TEMPLATE_ID,
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
        "adminId": os.environ["HANSARIA_ADMIN_ID"],
        "templateId": os.environ["HANSARIA_TEMPLATE_ID"],
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
  "adminId" => getenv("HANSARIA_ADMIN_ID"),
  "templateId" => getenv("HANSARIA_TEMPLATE_ID"),
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
  const connectionTestExamples: Record<CodeLanguage, string> = {
    JavaScript: `const url = new URL("https://hfconnect.in/api/v1/connection/test");
url.searchParams.set("adminId", process.env.HANSARIA_ADMIN_ID);
url.searchParams.set("templateId", process.env.HANSARIA_TEMPLATE_ID);

const response = await fetch(url, {
  headers: {
    Authorization: "Bearer " + process.env.HANSARIA_API_KEY
  }
});
const result = await response.json();
if (!response.ok) {
  throw new Error(result.error || \`Connection test failed: \${response.status}\`);
}
console.log(result.message, result.checks);`,
    Python: `import os
import requests

response = requests.get(
    "https://hfconnect.in/api/v1/connection/test",
    headers={"Authorization": "Bearer " + os.environ["HANSARIA_API_KEY"]},
    params={
        "adminId": os.environ["HANSARIA_ADMIN_ID"],
        "templateId": os.environ["HANSARIA_TEMPLATE_ID"],
    },
    timeout=30,
)
result = response.json()
if not response.ok:
    raise RuntimeError(result.get("error", f"Connection test failed: {response.status_code}"))
print(result["message"], result["checks"])`,
    PHP: `<?php
$url = "https://hfconnect.in/api/v1/connection/test?" . http_build_query([
  "adminId" => getenv("HANSARIA_ADMIN_ID"),
  "templateId" => getenv("HANSARIA_TEMPLATE_ID")
]);
$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_HTTPHEADER => ["Authorization: Bearer " . getenv("HANSARIA_API_KEY")],
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
  throw new RuntimeException($result["error"] ?? "Connection test failed: " . $status);
}
echo $result["message"];`,
  };
  const example = examples[language];
  const connectionTestExample = connectionTestExamples[language];
  const environmentExample = `HANSARIA_ADMIN_ID=${template.adminId}
HANSARIA_API_KEY=${apiKey || "paste-your-admin-workspace-api-key-here"}
HANSARIA_TEMPLATE_ID=${template._id}`;

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
          Connect with the admin/workspace ID, an API key created for that
          workspace, and this template ID. The saved subject and body are sent
          as one chat message; fill in the listed variables. The recipient ID
          is supplied for each message, not stored as a connection credential.
          Run this on your server and keep the API key secret.
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
          Replace <code>RECIPIENT_CHAT_ACCOUNT_ID</code> with the recipient for
          each send and supply{" "}
          {variableNames.length
            ? variableNames.map((name) => `YOUR_${name.toUpperCase()}`).join(", ")
            : "no template variables"}.
          The sender account is selected from the API key.
        </p>
        <div className="mt-5 border-t border-white/15 pt-4">
          <h3 className="font-semibold text-white">Connection credentials</h3>
          <p className="mt-1 leading-5 text-slate-300">
            The workspace ID and template ID are filled in. Enter an active API
            key created for this workspace. The sender account must already be
            bound to that key in Admin &gt; API Keys.
          </p>
          <label className="mt-3 block">
            <span className="mb-1 block font-medium">Workspace API key</span>
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value.trim())}
              placeholder="Paste the key shown when you created it"
              className="w-full rounded-md border border-white/20 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-400"
            />
          </label>
          <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 p-3">
            <code>{environmentExample}</code>
          </pre>
          <button
            type="button"
            onClick={copyEnvironment}
            className="mt-3 rounded-md bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950 hover:bg-emerald-300"
          >
            Copy connection settings
          </button>
          <p className="mt-2 min-h-5 text-slate-300" aria-live="polite">
            {environmentCopyStatus}
          </p>
          <p className="mt-1 leading-5 text-amber-200">
            The API key is kept only in this page&apos;s temporary form state;
            HansariaConnect does not save it. Its raw secret is shown only
            once, so create a new key if it is lost.
          </p>
          <div className="mt-4 border-t border-white/15 pt-4">
            <h4 className="font-semibold text-white">
              Test the connection (no message sent)
            </h4>
            <p className="mt-1 leading-5 text-slate-300">
              The test checks the API key, workspace, bound sender, and saved
              template. A recipient is not required until you send a message.
            </p>
            <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
              <code>{connectionTestExample}</code>
            </pre>
          </div>
        </div>
      </div>
    </details>
  );
}
