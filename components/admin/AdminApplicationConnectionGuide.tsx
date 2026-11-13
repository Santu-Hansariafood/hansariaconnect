"use client";

import ConnectionTroubleshooting from "./application-connection/ConnectionTroubleshooting";
import ConnectionApiTest from "./application-connection/ConnectionApiTest";
import SetupSteps from "./application-connection/SetupSteps";
import WhatsAppTemplateBuilder from "./application-connection/WhatsAppTemplateBuilder";
import WebhookSettings from "./WebhookSettings";
import type {
  BuilderTemplate,
  DashboardTab,
} from "./application-connection/types";

type AdminApplicationConnectionGuideProps = {
  isPlatformAdmin: boolean;
  adminId: string;
  workspaces: { _id: string; userId: string }[];
  templates: BuilderTemplate[];
  onNavigate: (tab: DashboardTab) => void;
  onCreateApiKey: () => void;
  onKeyCreated: () => void;
};

export default function AdminApplicationConnectionGuide({
  isPlatformAdmin,
  adminId,
  workspaces,
  templates,
  onNavigate,
  onCreateApiKey,
  onKeyCreated,
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
              Send messages with the API and receive message events through a
              signed HTTPS webhook
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
        <WebhookSettings
          adminId={adminId}
          isPlatformAdmin={isPlatformAdmin}
          workspaces={workspaces}
        />
        <ConnectionApiTest adminId={adminId} onKeyCreated={onKeyCreated} />
        <WhatsAppTemplateBuilder
          templates={templates}
          isPlatformAdmin={isPlatformAdmin}
          onCreateTemplate={() => onNavigate("templates")}
        />
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
          The API key lets your other application send messages. Configure the
          webhook below to send new-message and status-change events back to
          your application. Admin login credentials are never used by either
          integration.
        </p>
        <ConnectionTroubleshooting />
      </div>
    </details>
  );
}
