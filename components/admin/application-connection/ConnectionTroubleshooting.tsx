export default function ConnectionTroubleshooting() {
  return (
    <>
      <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-950">
          Getting HTTP 401? Check these details
        </h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-6 text-amber-900">
          <li>
            Send the API key as <code>Authorization: Bearer YOUR_API_KEY</code>.
            Confirm it is active, not expired, and copied correctly.
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
        The example sends an in-app message, not SMS. To use a saved template
        instead, create it in My templates and use <code>templateName</code> or{" "}
        <code>templateId</code>. Bulk sends use{" "}
        <code>POST /api/v1/messages/bulk</code>.
      </p>
    </>
  );
}
