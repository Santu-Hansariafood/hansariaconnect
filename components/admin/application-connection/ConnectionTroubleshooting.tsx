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
      <p className="text-sm leading-6 text-slate-600">
        The example sends an in-app message, not SMS. It sends to one recipient
        using <code>POST /api/v1/messages/send</code>. To send to multiple
        recipients, use <code>POST /api/v1/messages/bulk</code> with a{" "}
        <code>recipients</code> array. To use a saved template, create it in My
        templates and use <code>templateName</code> or <code>templateId</code>.
      </p>
    </>
  );
}
