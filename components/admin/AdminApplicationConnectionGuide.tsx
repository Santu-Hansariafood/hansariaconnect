"use client";

import { useState } from "react";

type DashboardTab = "users" | "accounts" | "templates";
type ExampleLanguage = "JavaScript" | "Python" | "PHP";

type AdminApplicationConnectionGuideProps = {
  isPlatformAdmin: boolean;
  onNavigate: (tab: DashboardTab) => void;
  onCreateApiKey: () => void;
};

const examples: Record<ExampleLanguage, string> = {
  JavaScript: `const response = await fetch(
  "https://hansariaconnect.com/api/v1/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${process.env.HANSARIA_API_KEY}\`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      adminUserId: process.env.HANSARIA_ADMIN_ID,
      adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
      template: "Hi {{name}}, your order {{orderId}} has been updated.",
      language: "en",
      toUserId: "RECIPIENT_CHAT_ACCOUNT_ID",
      variables: { name: "Asha", orderId: "ORD-1001" }
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
    "https://hansariaconnect.com/api/v1/messages/send",
    headers={
        "Authorization": f"Bearer {os.environ['HANSARIA_API_KEY']}",
        "Content-Type": "application/json",
    },
    json={
        "adminUserId": os.environ["HANSARIA_ADMIN_ID"],
        "adminPassword": os.environ["HANSARIA_ADMIN_PASSWORD"],
        "template": "Hi {{name}}, your order {{orderId}} has been updated.",
        "language": "en",
        "toUserId": "RECIPIENT_CHAT_ACCOUNT_ID",
        "variables": {"name": "Asha", "orderId": "ORD-1001"},
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
  "template" => "Hi {{name}}, your order {{orderId}} has been updated.",
  "language" => "en",
  "toUserId" => "RECIPIENT_CHAT_ACCOUNT_ID",
  "variables" => ["name" => "Asha", "orderId" => "ORD-1001"]
];

$ch = curl_init("https://hansariaconnect.com/api/v1/messages/send");
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

export default function AdminApplicationConnectionGuide({
  isPlatformAdmin,
  onNavigate,
  onCreateApiKey,
}: AdminApplicationConnectionGuideProps) {
  const [language, setLanguage] = useState<ExampleLanguage>("JavaScript");
  const linkColor = isPlatformAdmin ? "text-indigo-700" : "text-emerald-700";
  const borderColor = isPlatformAdmin ? "border-indigo-200" : "border-emerald-200";

  return (
    <details className={`group rounded-2xl border bg-white shadow-sm ${borderColor}`}>
      <summary
        className={`cursor-pointer list-none px-5 py-4 font-semibold sm:px-6 ${
          isPlatformAdmin ? "text-indigo-950" : "text-emerald-950"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Connect your application
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Simple setup and code examples
            </span>
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPlatformAdmin
                ? "bg-indigo-100 text-indigo-800"
                : "bg-emerald-100 text-emerald-800"
            }`}
          >
            {isPlatformAdmin ? "Super Admin" : "Admin"}
          </span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-slate-100 px-5 py-5 sm:px-6">
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">1. Prepare accounts</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The sender and recipient both need HansariaConnect accounts.
              {isPlatformAdmin
                ? " Choose accounts from the User directory."
                : " Create accounts from Accounts."}
            </p>
            <button
              type="button"
              onClick={() => onNavigate(isPlatformAdmin ? "users" : "accounts")}
              className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
            >
              {isPlatformAdmin ? "Open User directory" : "Open Accounts"}
            </button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">2. Write your message</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The example includes a ready-to-edit message with{" "}
              <code>{"{{name}}"}</code> and <code>{"{{orderId}}"}</code>.
              Matching values are already included. Saved templates are
              optional.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("templates")}
              className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
            >
              Browse saved templates
            </button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">3. Create an API key</p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Bind a sender account to the key. Save the key securely; it is
              shown only once.
            </p>
            <button
              type="button"
              onClick={onCreateApiKey}
              className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
            >
              Create API key
            </button>
          </li>
        </ol>

        <section className="rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900">Send one message</h3>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            The message and variables are ready to use. Set the three{" "}
            <code>HANSARIA_*</code> server environment values, then replace{" "}
            <code>RECIPIENT_CHAT_ACCOUNT_ID</code> with the recipient&apos;s
            HansariaConnect account ID. Run this on your server, never in
            browser code. This sends an in-app message, not SMS.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs leading-5 text-slate-800">
            <code>{`# Add to your server's .env file
HANSARIA_API_KEY=paste-your-api-key
HANSARIA_ADMIN_ID=paste-your-admin-login-id
HANSARIA_ADMIN_PASSWORD=paste-your-admin-password`}</code>
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label
              htmlFor="connection-guide-language"
              className="text-sm font-medium text-slate-700"
            >
              Example language
            </label>
            <select
              id="connection-guide-language"
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
              className={`rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${
                isPlatformAdmin
                  ? "focus:ring-indigo-500"
                  : "focus:ring-emerald-500"
              }`}
            >
              {Object.keys(examples).map((exampleLanguage) => (
                <option key={exampleLanguage} value={exampleLanguage}>
                  {exampleLanguage}
                </option>
              ))}
            </select>
          </div>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
            <code>{examples[language]}</code>
          </pre>
        </section>

        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h3 className="font-semibold text-amber-950">
            Getting HTTP 401? Check these details
          </h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-amber-900">
            <li>
              Send the API key as <code>Authorization: Bearer YOUR_API_KEY</code>
              . Confirm it is active, not expired, and copied correctly.
            </li>
            <li>
              <code>adminUserId</code> must be the key owner&apos;s login ID or
              email, and <code>adminPassword</code> must be that admin&apos;s
              password.
            </li>
            <li>
              Read the response&apos;s <code>error</code> field; it tells you
              whether the key or admin credentials were rejected.
            </li>
          </ul>
        </section>

        <p className="text-sm leading-6 text-slate-600">
          For saved templates, replace <code>template</code> with{" "}
          <code>templateName</code> (or <code>templateId</code>) and pass a
          matching saved template. The <code>language</code> field selects its
          translation. Bulk sending uses{" "}
          <code>POST /api/v1/messages/bulk</code>. Keep your API key and admin
          password in server-only environment variables.
        </p>
      </div>
    </details>
  );
}
