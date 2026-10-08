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
  const linkColor = isPlatformAdmin ? "text-indigo-700" : "text-emerald-700";

  return (
    <ol className="grid gap-3 sm:grid-cols-2">
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
        <p className="font-semibold text-slate-900">2. Create an API key</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Bind a sender account to the key. Save the key securely; it is shown
          only once.
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
