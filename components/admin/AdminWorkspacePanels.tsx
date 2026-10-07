"use client";

import type { FormEvent, SetStateAction } from "react";
import { getTemplateVariableNames } from "@/lib/messageTemplates";
import { adminFieldClass } from "@/components/admin/adminConstants";

export interface AdminMessageTemplate {
  _id: string;
  name: string;
  body: string;
}

export function AccountRegistrationPanel({
  onRegisterAccounts,
}: {
  onRegisterAccounts: () => void;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">
        Register chat accounts
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Register multiple chat accounts with the admin Excel template.
      </p>
      <button
        onClick={onRegisterAccounts}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
      >
        Register Accounts
      </button>
    </div>
  );
}

interface AdminTemplatesPanelProps {
  isPlatformAdmin: boolean;
  templates: AdminMessageTemplate[];
  templateName: string;
  setTemplateName: (value: SetStateAction<string>) => void;
  templateBody: string;
  setTemplateBody: (value: SetStateAction<string>) => void;
  isSaving: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
}

export function AdminTemplatesPanel({
  isPlatformAdmin,
  templates,
  templateName,
  setTemplateName,
  templateBody,
  setTemplateBody,
  isSaving,
  onCreate,
  onDelete,
}: AdminTemplatesPanelProps) {
  const templateVariableNames = getTemplateVariableNames(templateBody);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <form
        onSubmit={onCreate}
        className={`rounded-2xl border bg-white p-6 shadow-sm ${
          isPlatformAdmin ? "border-indigo-200" : "border-gray-200"
        }`}
      >
        <p
          className={`text-xs font-bold uppercase tracking-[0.16em] ${
            isPlatformAdmin ? "text-indigo-700" : "text-emerald-800"
          }`}
        >
          {isPlatformAdmin ? "Super Admin workspace" : "Admin workspace"}
        </p>
        <h2 className="mt-2 text-lg font-semibold text-gray-800">
          Create a message template
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Templates created here belong only to{" "}
          {isPlatformAdmin ? "your Super Admin account" : "this admin account"}
          .
        </p>
        <input
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="Template name"
          maxLength={100}
          className={`mt-4 ${adminFieldClass}`}
          required
        />
        <textarea
          value={templateBody}
          onChange={(event) => setTemplateBody(event.target.value)}
          placeholder="Hello {{name}}, your update is ready."
          rows={6}
          maxLength={2000}
          className={`mt-3 ${adminFieldClass}`}
          required
        />
        <p className="mt-2 text-xs text-gray-500">
          Placeholders such as {"{{name}}"} and {"{{orderId}}"} are saved as
          written, then filled from the variables you pass to the API. The saved
          template text is not modified.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Template names are unique within your admin account and are not
          visible to other admins.
        </p>
        {templateVariableNames.length > 0 && (
          <p className="mt-2 text-xs font-medium text-emerald-700">
            Required variables: {templateVariableNames.join(", ")}
          </p>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className={`mt-4 rounded-xl px-5 py-3 font-semibold text-white disabled:opacity-60 ${
            isPlatformAdmin
              ? "bg-indigo-700 hover:bg-indigo-800"
              : "bg-emerald-700 hover:bg-emerald-800"
          }`}
        >
          {isSaving ? "Saving..." : "Save template"}
        </button>
      </form>

      <div className="space-y-3">
        {templates.map((template) => {
          const variableNames = getTemplateVariableNames(template.body);
          const variables = Object.fromEntries(
            variableNames.map((variable) => [
              variable,
              `YOUR_${variable.toUpperCase()}`,
            ]),
          );

          return (
            <div
              key={template._id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold text-gray-800">{template.name}</h3>
                <button
                  onClick={() => onDelete(template._id)}
                  className="text-sm text-red-600"
                >
                  Delete
                </button>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                {template.body}
              </p>
              {variableNames.length > 0 ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  {variableNames.length} variable
                  {variableNames.length === 1 ? "" : "s"}:{" "}
                  {variableNames.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-gray-500">0 variables</p>
              )}
              <p className="mt-3 break-all text-xs text-gray-500">
                Template ID: <code>{template._id}</code>
              </p>
              <details className="mt-3">
                <summary
                  className={`cursor-pointer text-sm font-medium ${
                    isPlatformAdmin ? "text-indigo-700" : "text-emerald-700"
                  }`}
                >
                  API integration example
                </summary>
                <div className="mt-3 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                  <p className="mb-2">
                    This template has {variableNames.length} variable
                    {variableNames.length === 1 ? "" : "s"}. Include admin
                    credentials, this admin&apos;s API key, and the template
                    name. Supply every listed variable; missing values are
                    rejected.
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                    {`await fetch("https://YOUR_DOMAIN/api/v1/messages/send", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "adminUserId": "YOUR_ADMIN_USER_ID",
    "adminPassword": "YOUR_ADMIN_PASSWORD",
    "templateName": "${template.name}",
    "fromUserId": "SENDER_CHAT_ACCOUNT_ID",
    "toUserId": "RECIPIENT_USER_ID",
    "variables": ${JSON.stringify(variables, null, 2).replace(/\n/g, "\n    ")},
    "attachment": {
      "type": "pdf",
      "mediaUrl": "https://files.example.com/orders/ORD-1001.pdf",
      "fileName": "ORD-1001.pdf"
    }
  })
});`}
                  </pre>
                  <p className="mt-3 text-slate-300">
                    For bulk messages use POST /api/v1/messages/bulk. Bind the
                    sender chat account to the API key first; bulk requests use
                    that bound sender. Replace toUserId with a recipients array
                    and pass the same adminUserId, adminPassword, and variables
                    for each recipient. Attachments are optional, sent from an
                    HTTPS URL, and can use image, pdf, video, excel, or file.
                    Send requests server-to-server over HTTPS; never expose the
                    admin password or API key in browser or mobile-app code.
                    Credentials must belong to the admin who owns both the API
                    key and template. For single sends, fromUserId must be an
                    account created by this admin unless the API key is already
                    bound to a sender.
                  </p>
                </div>
              </details>
            </div>
          );
        })}
        {!templates.length && (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
            No templates yet.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminProfilePanel({
  userId,
  email,
  setEmail,
  password,
  setPassword,
  isSaving,
  onSave,
}: {
  userId: string;
  email: string;
  setEmail: (value: SetStateAction<string>) => void;
  password: string;
  setPassword: (value: SetStateAction<string>) => void;
  isSaving: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form
      onSubmit={onSave}
      className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-gray-800">Admin profile</h2>
      <p className="mt-1 text-sm text-gray-500">Signed in as {userId}</p>
      <label
        htmlFor="admin-profile-email"
        className="mt-5 block text-sm font-medium text-gray-700"
      >
        Email
      </label>
      <input
        id="admin-profile-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className={`mt-1 ${adminFieldClass}`}
        required
      />
      <label
        htmlFor="admin-profile-password"
        className="mt-4 block text-sm font-medium text-gray-700"
      >
        New password
      </label>
      <input
        id="admin-profile-password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Leave blank to keep current password"
        className={`mt-1 ${adminFieldClass}`}
      />
      <button
        type="submit"
        disabled={isSaving}
        className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {isSaving ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
