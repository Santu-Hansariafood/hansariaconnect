"use client";

import ConnectionTroubleshooting from "./application-connection/ConnectionTroubleshooting";
import SetupSteps from "./application-connection/SetupSteps";
import WhatsAppTemplateBuilder from "./application-connection/WhatsAppTemplateBuilder";
import type {
  BuilderTemplate,
  DashboardTab,
} from "./application-connection/types";

type AdminApplicationConnectionGuideProps = {
  isPlatformAdmin: boolean;
  templates: BuilderTemplate[];
  onNavigate: (tab: DashboardTab) => void;
  onCreateApiKey: () => void;
};

export default function AdminApplicationConnectionGuide({
  isPlatformAdmin,
  templates,
  onNavigate,
  onCreateApiKey,
}: AdminApplicationConnectionGuideProps) {
  const borderColor = isPlatformAdmin
    ? "border-indigo-200 dark:border-indigo-800"
    : "border-emerald-200 dark:border-emerald-800";

  return (
    <details
      className={`group rounded-2xl border bg-white shadow-sm dark:bg-slate-900 ${borderColor}`}
    >
      <summary
        className={`cursor-pointer list-none px-5 py-4 font-semibold sm:px-6 ${
          isPlatformAdmin
            ? "text-indigo-950 dark:text-indigo-100"
            : "text-emerald-950 dark:text-emerald-100"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Connect your application with a saved template
            <span className="mt-1 block text-sm font-normal text-slate-500 dark:text-slate-400">
              One API key is all your other app needs — copy it once and send
              with a single POST
            </span>
          </span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isPlatformAdmin
                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            }`}
          >
            {isPlatformAdmin ? "Super Admin" : "Admin"}
          </span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-slate-100 px-5 py-5 dark:border-slate-800 sm:px-6">
        <SetupSteps
          isPlatformAdmin={isPlatformAdmin}
          onNavigate={onNavigate}
          onCreateApiKey={onCreateApiKey}
        />
        <WhatsAppTemplateBuilder
          templates={templates}
          isPlatformAdmin={isPlatformAdmin}
          onCreateTemplate={() => onNavigate("templates")}
        />
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          Your other application only needs the API key and the send endpoint.
          The template ID is optional per message, and the recipient account is
          provided when each message is sent. Admin login credentials are never
          used by the integration. Open a template&apos;s API integration
          example to copy a ready-to-paste config block and test command.
        </p>
        <ConnectionTroubleshooting />
      </div>
    </details>
  );
}
