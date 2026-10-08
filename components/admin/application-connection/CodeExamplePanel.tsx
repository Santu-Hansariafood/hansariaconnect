import { useState } from "react";
import type { ExampleLanguage, MessageVariable } from "./types";

type CodeExamplePanelProps = {
  template: string;
  variables: MessageVariable[];
  isPlatformAdmin: boolean;
};

const phpString = (value: string) =>
  `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

const createExamples = (
  template: string,
  variables: MessageVariable[],
): Record<ExampleLanguage, string> => {
  const values = Object.fromEntries(
    variables.map(({ name, value }) => [name, value]),
  );
  const formattedVariables = JSON.stringify(values, null, 2);
  const phpVariables = Object.entries(values)
    .map(([name, value]) => `    ${phpString(name)} => ${phpString(value)}`)
    .join(",\n");

  return {
    JavaScript: `const response = await fetch(
  "https://hfconnect.in/api/v1/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      adminUserId: process.env.HANSARIA_ADMIN_ID,
      adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
      template: ${JSON.stringify(template)},
      language: "en",
      toUserId: "RECIPIENT_CHAT_ACCOUNT_ID",
      variables: ${formattedVariables}
    })
  }
);

const result = await response.json();
if (!response.ok) {
  throw new Error(result.error || \`Request failed: \${response.status}\`);
}
console.log("Message sent");`,
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
        "template": ${JSON.stringify(template)},
        "language": "en",
        "toUserId": "RECIPIENT_CHAT_ACCOUNT_ID",
        "variables": ${formattedVariables},
    },
    timeout=30,
)

if not response.ok:
    raise RuntimeError(response.json().get("error", f"Request failed: {response.status_code}"))
print("Message sent")`,
    PHP: `<?php
$payload = [
  "adminUserId" => getenv("HANSARIA_ADMIN_ID"),
  "adminPassword" => getenv("HANSARIA_ADMIN_PASSWORD"),
  "template" => ${phpString(template)},
  "language" => "en",
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
  throw new RuntimeException($result["error"] ?? "Request failed: " . $status);
}
echo "Message sent";`,
  };
};

export default function CodeExamplePanel({
  template,
  variables,
  isPlatformAdmin,
}: CodeExamplePanelProps) {
  const [language, setLanguage] = useState<ExampleLanguage>("JavaScript");
  const [copyStatus, setCopyStatus] = useState("");
  const examples = createExamples(template, variables);
  const example = examples[language];
  const hasDuplicateNames =
    new Set(variables.map(({ name }) => name)).size !== variables.length;
  const hasInvalidVariableNames = variables.some(
    ({ name }) => !/^[a-zA-Z0-9_]+$/.test(name),
  );
  const templateTooLong = template.length > 2000;

  const copyExample = async () => {
    try {
      await navigator.clipboard.writeText(example);
      setCopyStatus("Code copied.");
    } catch {
      setCopyStatus("Copy failed. Select the code and copy it manually.");
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">Copy your code</h3>
          <p className="mt-1 text-sm text-slate-600">
            Replace the recipient ID. Keep your credentials on your server.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          Code language
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
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option>JavaScript</option>
            <option>Python</option>
            <option>PHP</option>
          </select>
        </label>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
        <code>{example}</code>
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={copyExample}
          disabled={
            hasDuplicateNames || hasInvalidVariableNames || templateTooLong
          }
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400 ${
            isPlatformAdmin ? "bg-indigo-700" : "bg-emerald-700"
          }`}
        >
          Copy code
        </button>
        <span aria-live="polite" className="text-sm text-slate-600">
          {copyStatus}
        </span>
      </div>
      {templateTooLong && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          The combined header, body, and footer must be 2,000 characters or
          fewer.
        </p>
      )}
      <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-800">
        <code>{`# Add these to your server's environment
HANSARIA_API_KEY=paste-your-api-key
HANSARIA_ADMIN_ID=paste-your-admin-login-id
HANSARIA_ADMIN_PASSWORD=paste-your-admin-password`}</code>
      </pre>
    </section>
  );
}
