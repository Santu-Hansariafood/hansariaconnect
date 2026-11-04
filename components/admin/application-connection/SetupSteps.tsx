import type { DashboardTab } from "./types";

type SetupStepsProps = {
  isPlatformAdmin: boolean;
  onNavigate: (tab: DashboardTab) => void;
  onCreateApiKey: () => void;
};

export default function SetupSteps({
  isPlatformAdmin,
  onNavigate,
  onCreateApiKey,
}: SetupStepsProps) {
  const linkColor = isPlatformAdmin
    ? "text-indigo-700 dark:text-indigo-300"
    : "text-emerald-700 dark:text-emerald-300";

  return (
    <ol className="grid gap-3 sm:grid-cols-2">
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-100">1. Prepare chat accounts</p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Bind an existing sender account to your API key. Each recipient needs
          a registered HansariaConnect account.
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
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-100">2. Create a template</p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Create an email-style subject and body with any required variables.
          The saved template ID is the template key for your integration.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("templates")}
          className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
        >
          Open templates
        </button>
      </li>
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-100">
          3. Optional: workspace ID
        </p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Not needed to send messages or to test the connection. Provide it only
          when a super-admin key must target another workspace; it is not a
          secret and is shown on the Admin Profile.
        </p>
        <button
          type="button"
          onClick={() => onNavigate("profile")}
          className={`mt-2 text-sm font-semibold hover:underline ${linkColor}`}
        >
          Open Admin Profile
        </button>
      </li>
      <li className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
        <p className="font-semibold text-slate-900 dark:text-slate-100">4. Create an API key</p>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
          Bind a sender chat account to this key, or include its account ID as
          fromUserId in each request. This is a user account ID, not the
          workspace adminId. Mark your preferred key as primary and use its
          secret as HANSARIA_API_KEY; the secret is shown only once. Other keys
          remain active for rotation.
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
  );
}
