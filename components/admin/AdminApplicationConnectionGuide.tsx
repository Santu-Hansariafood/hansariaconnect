"use client";

import { useState } from "react";
import CodeExamplePanel from "./application-connection/CodeExamplePanel";
import ConnectionTroubleshooting from "./application-connection/ConnectionTroubleshooting";
import MessageTemplateBuilder from "./application-connection/MessageTemplateBuilder";
import SetupSteps from "./application-connection/SetupSteps";
import type { DashboardTab, MessageVariable } from "./application-connection/types";

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
  const [header, setHeader] = useState("Order update");
  const [body, setBody] = useState(
    "Hi {{name}}, your order {{orderId}} has been updated.",
  );
  const [footer, setFooter] = useState("Reply if you need help.");
  const [variables, setVariables] = useState<MessageVariable[]>([
    { name: "name", value: "Asha" },
    { name: "orderId", value: "ORD-1001" },
  ]);
  const borderColor = isPlatformAdmin ? "border-indigo-200" : "border-emerald-200";
  const messageTemplate = [header, body, footer]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");

  return (
    <details className={`group rounded-2xl border bg-white shadow-sm ${borderColor}`}>
      <summary
        className={`cursor-pointer list-none px-5 py-4 font-semibold sm:px-6 ${
          isPlatformAdmin ? "text-indigo-950" : "text-emerald-950"
        }`}
      >
        <span className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Connect your application
            <span className="mt-1 block text-sm font-normal text-slate-500">
              Build a message and copy ready-to-use code
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
        <MessageTemplateBuilder
          header={header}
          body={body}
          footer={footer}
          variables={variables}
          isPlatformAdmin={isPlatformAdmin}
          onHeaderChange={setHeader}
          onBodyChange={setBody}
          onFooterChange={setFooter}
          onVariablesChange={setVariables}
        />
        <CodeExamplePanel
          template={messageTemplate}
          variables={variables}
          isPlatformAdmin={isPlatformAdmin}
        />
        <ConnectionTroubleshooting />
      </div>
    </details>
  );
}
