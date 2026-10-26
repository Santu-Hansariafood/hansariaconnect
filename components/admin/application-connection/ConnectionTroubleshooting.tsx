export default function ConnectionTroubleshooting() {
  return (
    <>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-950">
          Getting HTTP 401? Check your API key
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-amber-900">
          <li>
            Send the API key as <code>Authorization: Bearer YOUR_API_KEY</code>.
            Confirm it is active, not expired, and copied correctly.
          </li>
          <li>
            Use an active API key created in the account that owns the
            template. The API key alone authenticates the request; no admin
            login ID or password is needed.
          </li>
          <li>Read the response&apos;s <code>error</code> field for details.</li>
        </ul>
      </section>
      <section className="rounded-xl border border-sky-300 bg-sky-50 p-4">
        <h3 className="font-semibold text-sky-950">
          Which step failed? Read <code>failedAt</code>
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-sky-900">
          <li>
            Call <code>GET /api/v1/connection/test</code> and check{" "}
            <code>failedAt</code>. Every response also returns a{" "}
            <code>checks</code> object showing{" "}
            <code>ok</code>, <code>failed</code>, or <code>skipped</code> for{" "}
            <code>apiKey</code>, <code>request</code>, <code>sender</code>,{" "}
            <code>adminWorkspace</code>, and <code>template</code>.
          </li>
          <li>
            Browser and front-end JavaScript callers are supported:{" "}
            <code>/api/v1/*</code> answers CORS preflight requests and sends{" "}
            <code>Access-Control-Allow-Origin</code> on every response. If you
            still see a blocked request, confirm the URL is{" "}
            <code>https://hfconnect.in/api/v1/...</code> and not an internal
            hostname.
          </li>
          <li>
            Rate-limit headers (<code>X-RateLimit-*</code>) are exposed to the
            browser, so your other app can read its remaining quota and{" "}
            <code>Retry-After</code> on a <code>429</code>.
          </li>
        </ul>
      </section>
      <p className="text-sm leading-6 text-slate-600">
        The example sends an in-app message, not SMS. It sends to one recipient
        using <code>POST /api/v1/messages/send</code>. To send to multiple
        recipients, use <code>POST /api/v1/messages/bulk</code> with a{" "}
        <code>recipients</code> array; each recipient can be a chat account ID
        or registered Indian mobile number. In the template test builder,
        choose one or multiple recipients and paste a comma- or newline-separated
        list. For personalized messages, include a separate <code>variables</code>{" "}
        object in each recipient entry. To use a saved template, create it in My
        templates and use <code>templateName</code> or <code>templateId</code>.
      </p>
      <p className="text-sm leading-6 text-slate-600">
        Bulk sends return HTTP <code>202</code> with a <code>jobId</code> and{" "}
        <code>statusUrl</code> as soon as the request is accepted. Poll the
        status URL with the same API key to track each recipient; the VPS bulk
        worker processes the messages in the background.
      </p>
    </>
  );
}
