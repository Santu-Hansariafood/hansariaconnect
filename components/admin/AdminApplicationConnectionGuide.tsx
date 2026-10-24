"use client";

import ConnectionTroubleshooting from "./application-connection/ConnectionTroubleshooting";
import SetupSteps from "./application-connection/SetupSteps";
import WhatsAppTemplateBuilder from "./application-connection/WhatsAppTemplateBuilder";
import type { BuilderTemplate, DashboardTab } from "./application-connection/types";

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
            Connect your application with a saved template
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Use only the workspace ID, API key, and template ID as connection
              credentials
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
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Open the template&apos;s API integration example to copy the
          workspace ID, API key, and saved template ID. The recipient
          account is provided when each message is sent; admin login
          credentials are not used by the integration.
        </p>
        <ConnectionTroubleshooting />
      </div>
    </details>
  );
}
