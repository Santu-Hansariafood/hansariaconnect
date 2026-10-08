"use client";

type DashboardTab = "users" | "accounts" | "templates";

type AdminApplicationConnectionGuideProps = {
  isPlatformAdmin: boolean;
  onNavigate: (tab: DashboardTab) => void;
  onCreateApiKey: () => void;
};

export default function AdminApplicationConnectionGuide({
  isPlatformAdmin,
  onNavigate,
  onCreateApiKey,
}: AdminApplicationConnectionGuideProps) {
  const linkColor = isPlatformAdmin ? "text-indigo-700" : "text-emerald-700";

  return (
    <details
      className={`group rounded-2xl border bg-white shadow-sm ${
        isPlatformAdmin ? "border-indigo-200" : "border-emerald-200"
      }`}
    >
      <summary
        className={`cursor-pointer list-none px-5 py-4 font-semibold sm:px-6 ${
          isPlatformAdmin ? "text-indigo-950" : "text-emerald-950"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            How to connect your application
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Setup steps, API request example, and notification requirements
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
      <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
        <ol className="grid gap-3 md:grid-cols-2">
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              1. Prepare the sender and recipient accounts
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {isPlatformAdmin
                ? "Register or choose chat accounts from the User directory. Super Admin API keys can be bound to an existing chat account."
                : "Register the chat accounts from Accounts. For an unbound key, the single-send sender must be an account created by this admin."}
            </p>
            <button
              type="button"
              onClick={() => onNavigate(isPlatformAdmin ? "users" : "accounts")}
              className={`mt-2 text-sm font-semibold hover:underline ${
                isPlatformAdmin ? "text-indigo-700" : "text-emerald-700"
              }`}
            >
              {isPlatformAdmin ? "Open User directory" : "Open Accounts"}
            </button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              2. Create a message template
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Create it in My templates/Templates. Use placeholders like{" "}
              {"{{name}}"} or {"{{orderId}}"}; send those exact variable names
              in your API request. Regular admins can only access their own
              templates; super admins can access templates across workspaces.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("templates")}
              className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
            >
              Open My templates
            </button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              3. Create an API key
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Select Create API key. For the easiest setup, bind the sender
              chat account ID. Bulk sends always need a bound sender; an
              unbound key can send one message only when the request supplies
              fromUserId (created by this admin). The secret is displayed once,
              so save it in your application&apos;s server-side secret store.
              The example below assumes the sender is bound to the key.
            </p>
            <button
              type="button"
              onClick={onCreateApiKey}
              className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
            >
              Create API key
            </button>
          </li>
          <li className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="font-semibold text-slate-900">
              4. Call the send endpoint from your server
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Use the HTTPS endpoint below and send the API key as a Bearer
              token. Include the owner admin&apos;s login ID and password, a
              recipient chat account ID, and values for each template variable.
            </p>
          </li>
        </ol>

        <div className="mt-5 overflow-hidden rounded-2xl bg-slate-950 text-slate-100">
          <div className="border-b border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300">
            Single-message request
          </div>
          <pre className="overflow-x-auto p-4 text-xs leading-6">
            {`const response = await fetch(
  "https://YOUR_DOMAIN/api/v1/messages/send",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      adminUserId: process.env.HANSARIA_ADMIN_ID,
      adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
      templateName: "Order update",
      toUserId: "RECIPIENT_CHAT_ACCOUNT_ID",
      variables: {
        name: "Customer name",
        orderId: "ORD-1001"
      }
    })
  }
);

const result = await response.json();
if (!response.ok) throw new Error(result.error);`}
          </pre>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900">
              Attachments and bulk sends
            </h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              For one attachment, add an attachment object with a supported
              type and an HTTPS mediaUrl. For bulk sends, call{" "}
              <code className="rounded bg-slate-100 px-1">
                /api/v1/messages/bulk
              </code>{" "}
              with a recipients array and bind the sender account to the key
              first. Bulk supports up to 1,000 recipients per request. Each API
              key is limited to 60 requests and 1,000 recipient messages per
              minute across both send endpoints; each bulk recipient counts as
              one message. Requests are limited to 2 MB. A 429 response
              includes a Retry-After header and rate-limit usage headers. Retry
              only after that delay, and do not retry non-429 errors blindly.
              The server defaults can be changed with
              API_RATE_LIMIT_REQUESTS_PER_MINUTE and
              API_RATE_LIMIT_MESSAGES_PER_MINUTE.
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-100">
              {`const response = await fetch(
  "https://YOUR_DOMAIN/api/v1/messages/bulk",
  {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      adminUserId: process.env.HANSARIA_ADMIN_ID,
      adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
      templateName: "Order update",
      recipients: [
        { toUserId: "CHAT_ACCOUNT_ID_1", variables: { name: "Customer 1" } },
        { toUserId: "CHAT_ACCOUNT_ID_2", variables: { name: "Customer 2" } }
      ]
    })
  }
);

const result = await response.json();
if (response.status === 429) {
  const retryAfterSeconds = Number(response.headers.get("Retry-After") || 1);
  throw new Error(\`Rate limit reached; retry in \${retryAfterSeconds} seconds\`);
}
if (!response.ok) throw new Error(result.error || "Message request failed");
console.log(\`Messages sent: \${result.sent}\`);`}
            </pre>
          </div>
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900">
              Browser message notifications
            </h4>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              The recipient must sign in to HansariaConnect and allow browser
              notifications using the dashboard control or Settings. Messages
              sent by API are delivered to the recipient&apos;s chat. Desktop
              notifications require the browser/app to be running; closed-
              browser push delivery is not configured.
            </p>
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Never call this endpoint directly from browser or mobile client code:
          that would expose the API key and admin password. Keep both in your
          application server&apos;s environment/secret manager and use HTTPS.
        </p>
      </div>
    </details>
  );
}
