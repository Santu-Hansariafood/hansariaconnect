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
        <section className="mt-5 overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50/50">
          <div className="border-b border-indigo-100 px-5 py-4">
            <h3 className="font-semibold text-indigo-950">
              Connect from a Next.js App Router application
            </h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Keep the HansariaConnect API key and admin credentials in your
              Next.js server environment. The browser calls your own Route
              Handler; that handler authenticates the app user and forwards
              only the validated recipient list.
            </p>
          </div>
          <div className="grid gap-4 p-4 lg:grid-cols-2 sm:p-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                app/api/hansaria/bulk/route.ts
              </p>
              <pre className="max-h-[34rem] overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {`import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth"; // Use your app's NextAuth config.

const requestSchema = z.object({
  recipients: z.array(z.object({
    toUserId: z.string().regex(/^[a-f0-9]{24}$/i),
    language: z.string().max(35).optional(),
    variables: z.record(
      z.string(),
      z.union([z.string().max(10000), z.number(), z.boolean()])
    ).optional()
  })).min(1).max(1000)
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowedEmail = process.env.BULK_MESSAGING_ALLOWED_EMAIL?.toLowerCase();
  if (!allowedEmail || session.user.email?.toLowerCase() !== allowedEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid request" },
      { status: 400 }
    );
  }

  const { HANSARIA_API_URL, HANSARIA_API_KEY,
    HANSARIA_ADMIN_ID, HANSARIA_ADMIN_PASSWORD } = process.env;
  if (!HANSARIA_API_URL || !HANSARIA_API_KEY ||
      !HANSARIA_ADMIN_ID || !HANSARIA_ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: "Messaging integration is not configured" },
      { status: 503 }
    );
  }

  try {
    const upstream = await fetch(
      \`\${HANSARIA_API_URL.replace(/\\/+$/, "")}/api/v1/messages/bulk\`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: \`Bearer \${HANSARIA_API_KEY}\`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          adminUserId: HANSARIA_ADMIN_ID,
          adminPassword: HANSARIA_ADMIN_PASSWORD,
          templateName: "Order update",
          recipients: parsed.data.recipients
        })
      }
    );
    const result = await upstream.json().catch(() => ({}));
    const headers = new Headers();
    for (const name of [
      "Retry-After",
      "X-RateLimit-Request-Limit",
      "X-RateLimit-Requests-Remaining",
      "X-RateLimit-Message-Limit",
      "X-RateLimit-Messages-Remaining",
      "X-RateLimit-Reset"
    ]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }

    if (!upstream.ok) {
      return NextResponse.json(
        { error: result.error || "Bulk message request failed" },
        { status: upstream.status, headers }
      );
    }
    return NextResponse.json(
      { success: true, sent: result.sent, template: result.template },
      { headers }
    );
  } catch {
    return NextResponse.json(
      { error: "Messaging service is unavailable" },
      { status: 502 }
    );
  }
}`}
              </pre>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">
                Call your own route from the app
              </p>
              <pre className="rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">
                {`const response = await fetch("/api/hansaria/bulk", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    recipients: [
      {
        toUserId: "64f1234567890abcdef12345",
        variables: { name: "Asha", orderId: "ORD-1001" }
      },
      {
        toUserId: "64f1234567890abcdef12346",
        language: "hi",
        variables: { name: "Rahul", orderId: "ORD-1002" }
      }
    ]
  })
});

const result = await response.json();
if (response.status === 429) {
  const retryAfter = response.headers.get("Retry-After");
  throw new Error(\`Rate limited. Retry after \${retryAfter} seconds.\`);
}
if (!response.ok) {
  throw new Error(result.error || "Could not send messages");
}
console.log(\`Sent \${result.sent} messages\`);`}
              </pre>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                This example allow-lists one app user by email; configure
                <code> BULK_MESSAGING_ALLOWED_EMAIL</code>, or replace this
                check with your app&apos;s role/tenant authorization. Also
                confirm the signed-in user is allowed to message each recipient
                before forwarding. Replace <code>authOptions</code> with your
                NextAuth config.
                Store the four <code>HANSARIA_*</code> values in server-only
                environment variables (never <code>NEXT_PUBLIC_*</code>), use
                HTTPS, and never log the credentials or full upstream request.
                Bulk sends are limited to 1,000 recipients per request.
              </div>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
                {`# .env.local (server only; do not prefix with NEXT_PUBLIC_)
HANSARIA_API_URL=https://your-hansariaconnect-domain
HANSARIA_API_KEY=your-one-time-generated-api-key
HANSARIA_ADMIN_ID=your-admin-login-id
HANSARIA_ADMIN_PASSWORD=your-admin-password
BULK_MESSAGING_ALLOWED_EMAIL=authorized-operator@your-app.com`}
              </pre>
            </div>
          </div>
        </section>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
          Never call this endpoint directly from browser or mobile client code:
          that would expose the API key and admin password. Keep both in your
          application server&apos;s environment/secret manager and use HTTPS.
        </p>
      </div>
    </details>
  );
}
