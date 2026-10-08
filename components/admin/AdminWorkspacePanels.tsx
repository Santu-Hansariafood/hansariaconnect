"use client";

import { useState, type FormEvent, type SetStateAction } from "react";
import { getTemplateVariableNames } from "@/lib/messageTemplates";
import { adminFieldClass } from "@/components/admin/adminConstants";

export interface AdminMessageTemplate {
  _id: string;
  name: string;
  body: string;
  defaultLanguage?: string;
  folder?: string;
  translations?: Record<string, string>;
  ownerUserId?: string;
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
  admins: { _id: string; userId: string; isSuperAdmin: boolean }[];
  currentAdminUserId: string;
  ownerAdminId: string;
  setOwnerAdminId: (value: SetStateAction<string>) => void;
  templates: AdminMessageTemplate[];
  templateName: string;
  setTemplateName: (value: SetStateAction<string>) => void;
  templateBody: string;
  setTemplateBody: (value: SetStateAction<string>) => void;
  editingTemplateId: string | null;
  editingTemplateName: string;
  setEditingTemplateName: (value: SetStateAction<string>) => void;
  editingTemplateBody: string;
  setEditingTemplateBody: (value: SetStateAction<string>) => void;
  folder: string;
  setFolder: (value: SetStateAction<string>) => void;
  defaultLanguage: string;
  setDefaultLanguage: (value: SetStateAction<string>) => void;
  translations: Record<string, string>;
  setTranslations: (value: SetStateAction<Record<string, string>>) => void;
  newTranslationLanguage: string;
  setNewTranslationLanguage: (value: SetStateAction<string>) => void;
  onAddTranslation: () => void;
  editingFolder: string;
  setEditingFolder: (value: SetStateAction<string>) => void;
  editingDefaultLanguage: string;
  setEditingDefaultLanguage: (value: SetStateAction<string>) => void;
  editingTranslations: Record<string, string>;
  setEditingTranslations: (
    value: SetStateAction<Record<string, string>>,
  ) => void;
  isSaving: boolean;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onEdit: (template: AdminMessageTemplate) => void;
  onCancelEdit: () => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (id: string) => void;
}

export function AdminTemplatesPanel({
  isPlatformAdmin,
  admins,
  currentAdminUserId,
  ownerAdminId,
  setOwnerAdminId,
  templates,
  templateName,
  setTemplateName,
  templateBody,
  setTemplateBody,
  editingTemplateId,
  editingTemplateName,
  setEditingTemplateName,
  editingTemplateBody,
  setEditingTemplateBody,
  folder,
  setFolder,
  defaultLanguage,
  setDefaultLanguage,
  translations,
  setTranslations,
  newTranslationLanguage,
  setNewTranslationLanguage,
  onAddTranslation,
  editingFolder,
  setEditingFolder,
  editingDefaultLanguage,
  setEditingDefaultLanguage,
  editingTranslations,
  setEditingTranslations,
  isSaving,
  onCreate,
  onEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: AdminTemplatesPanelProps) {
  const templateVariableNames = getTemplateVariableNames(templateBody);
  const [selectedFolder, setSelectedFolder] = useState("All folders");
  const folders = Array.from(
    new Set(templates.map((template) => template.folder || "General")),
  ).sort();
  const visibleTemplates =
    selectedFolder === "All folders"
      ? templates
      : templates.filter(
          (template) => (template.folder || "General") === selectedFolder,
        );

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
          {isPlatformAdmin
            ? "Super admins can manage templates across admin workspaces."
            : "Templates created here belong only to this admin account."}
        </p>
        {isPlatformAdmin && (
          <label className="mt-4 block text-sm font-medium text-gray-700">
            Create template for
            <select
              value={ownerAdminId}
              onChange={(event) => setOwnerAdminId(event.target.value)}
              className={`mt-1 ${adminFieldClass}`}
            >
              <option value="">Your Super Admin workspace</option>
              {admins
                .filter((admin) => admin.userId !== currentAdminUserId)
                .map((admin) => (
                  <option key={admin._id} value={admin._id}>
                    {admin.userId} workspace
                  </option>
                ))}
            </select>
          </label>
        )}
        <input
          value={templateName}
          onChange={(event) => setTemplateName(event.target.value)}
          placeholder="Template name"
          maxLength={100}
          className={`mt-4 ${adminFieldClass}`}
          required
        />
        <input
          value={folder}
          onChange={(event) => setFolder(event.target.value)}
          placeholder="Folder (for example: Orders)"
          maxLength={80}
          className={`mt-3 ${adminFieldClass}`}
          aria-label="Template folder"
          required
        />
        <label
          htmlFor="template-default-language"
          className="mt-3 block text-sm font-medium text-slate-700"
        >
          Default language code
        </label>
        <input
          id="template-default-language"
          value={defaultLanguage}
          onChange={(event) =>
            setDefaultLanguage(event.target.value.toLowerCase())
          }
          maxLength={35}
          pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
          className={`mt-1 ${adminFieldClass}`}
          placeholder="en"
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
        <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-semibold text-slate-800">
            Translations (language codes such as hi, bn, fr)
          </p>
          <div className="flex gap-2">
            <input
              value={newTranslationLanguage}
              onChange={(event) =>
                setNewTranslationLanguage(event.target.value.toLowerCase())
              }
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
              maxLength={35}
              pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
              placeholder="hi"
              aria-label="Language to add"
            />
            <button
              type="button"
              onClick={onAddTranslation}
              disabled={
                !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(
                  newTranslationLanguage,
                ) || Object.hasOwn(translations, newTranslationLanguage)
              }
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              Add language
            </button>
          </div>
          {Object.entries(translations).map(([language, text]) => (
            <div key={language}>
              <div className="mb-1 flex items-center justify-between">
                <label
                  htmlFor={`template-${language}`}
                  className="text-xs font-semibold uppercase text-slate-600"
                >
                  {language}
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setTranslations((previous) => {
                      const next = { ...previous };
                      delete next[language];
                      return next;
                    })
                  }
                  className="text-xs text-rose-700"
                >
                  Remove
                </button>
              </div>
              <textarea
                id={`template-${language}`}
                value={text}
                onChange={(event) =>
                  setTranslations((previous) => ({
                    ...previous,
                    [language]: event.target.value,
                  }))
                }
                maxLength={2000}
                rows={3}
                className={adminFieldClass}
                placeholder={`Translated message (${language})`}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Placeholders such as {"{{name}}"} and {"{{orderId}}"} are saved as
          written, then filled from the variables you pass to the API. The saved
          template text is not modified.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Template names are unique within each admin account. Regular admins
          can only see their own templates.
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
        <label className="block text-sm font-medium text-slate-700">
          Template folder
          <select
            value={selectedFolder}
            onChange={(event) => setSelectedFolder(event.target.value)}
            className={`mt-1 ${adminFieldClass}`}
          >
            <option>All folders</option>
            {folders.map((folderName) => (
              <option key={folderName}>{folderName}</option>
            ))}
          </select>
        </label>
        {visibleTemplates.map((template) => {
          const variableNames = getTemplateVariableNames(template.body);
          const isEditing = editingTemplateId === template._id;
          const variables = Object.fromEntries(
            variableNames.map((variable) => [
              variable,
              `YOUR_${variable.toUpperCase()}`,
            ]),
          );
          const phpVariables = Object.entries(variables)
            .map(([key, value]) => `"${key}" => "${value}"`)
            .join(", ");

          return (
            <div
              key={template._id}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-800">{template.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Folder: {template.folder || "General"}
                  </p>
                  {isPlatformAdmin && template.ownerUserId && (
                    <p className="mt-1 text-xs text-slate-500">
                      Owner: {template.ownerUserId}
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  {!isEditing && (
                    <button
                      onClick={() => onEdit(template)}
                      className="text-sm font-medium text-indigo-700"
                    >
                      Edit
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(template._id)}
                    className="text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
              {isEditing ? (
                <form onSubmit={onUpdate} className="mt-3 space-y-3">
                  <input
                    value={editingTemplateName}
                    onChange={(event) =>
                      setEditingTemplateName(event.target.value)
                    }
                    maxLength={100}
                    className={adminFieldClass}
                    aria-label="Template name"
                    required
                  />
                  <input
                    value={editingFolder}
                    onChange={(event) => setEditingFolder(event.target.value)}
                    maxLength={80}
                    className={adminFieldClass}
                    aria-label="Template folder"
                    required
                  />
                  <label
                    htmlFor={`edit-default-language-${template._id}`}
                    className="block text-sm font-medium text-slate-700"
                  >
                    Default language code
                  </label>
                  <input
                    id={`edit-default-language-${template._id}`}
                    value={editingDefaultLanguage}
                    onChange={(event) =>
                      setEditingDefaultLanguage(
                        event.target.value.toLowerCase(),
                      )
                    }
                    maxLength={35}
                    pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
                    className={adminFieldClass}
                    required
                  />
                  <textarea
                    value={editingTemplateBody}
                    onChange={(event) =>
                      setEditingTemplateBody(event.target.value)
                    }
                    maxLength={2000}
                    rows={5}
                    className={adminFieldClass}
                    aria-label="Template message"
                    required
                  />
                  <div className="flex gap-2">
                    <input
                      value={newTranslationLanguage}
                      onChange={(event) =>
                        setNewTranslationLanguage(
                          event.target.value.toLowerCase(),
                        )
                      }
                      maxLength={35}
                      pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*"
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2"
                      placeholder="New language code"
                      aria-label="New translation language"
                    />
                    <button
                      type="button"
                      disabled={
                        !/^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/.test(
                          newTranslationLanguage,
                        ) ||
                        Object.hasOwn(
                          editingTranslations,
                          newTranslationLanguage,
                        )
                      }
                      onClick={() =>
                        setEditingTranslations((previous) => ({
                          ...previous,
                          [newTranslationLanguage]: "",
                        }))
                      }
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
                    >
                      Add language
                    </button>
                  </div>
                  {Object.entries(editingTranslations).map(
                    ([language, text]) => (
                      <div key={language}>
                        <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase text-slate-600">
                          <label
                            htmlFor={`edit-template-${template._id}-${language}`}
                          >
                            {language}
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingTranslations((previous) => {
                                const next = { ...previous };
                                delete next[language];
                                return next;
                              })
                            }
                            className="ml-2 font-normal text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          id={`edit-template-${template._id}-${language}`}
                          value={text}
                          onChange={(event) =>
                            setEditingTranslations((previous) => ({
                              ...previous,
                              [language]: event.target.value,
                            }))
                          }
                          maxLength={2000}
                          rows={3}
                          className={adminFieldClass}
                        />
                      </div>
                    ),
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={onCancelEdit}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {isSaving ? "Saving..." : "Save changes"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="mt-2 text-xs font-semibold uppercase text-slate-500">
                    Default ({template.defaultLanguage || "en"})
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                    {template.body}
                  </p>
                </>
              )}
              {Object.entries(template.translations || {}).map(
                ([language, translation]) => (
                  <details
                    key={language}
                    className="mt-2 rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <summary className="cursor-pointer text-xs font-semibold uppercase text-slate-600">
                      Translation: {language}
                    </summary>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                      {translation}
                    </p>
                  </details>
                ),
              )}
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
    "language": "hi",
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
                  <p className="mt-4 font-semibold text-slate-200">
                    Bulk send with per-recipient languages
                  </p>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
                    {`// JavaScript (Node.js)
await fetch("https://YOUR_DOMAIN/api/v1/messages/bulk", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.HANSARIA_API_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    adminUserId: process.env.HANSARIA_ADMIN_ID,
    adminPassword: process.env.HANSARIA_ADMIN_PASSWORD,
    templateId: "${template._id}",
    recipients: [
      { toUserId: "USER_ID_1", language: "hi", variables: ${JSON.stringify(variables)} },
      { toUserId: "USER_ID_2", language: "bn", variables: ${JSON.stringify(variables)} }
    ]
  })
});`}
                  </pre>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
                    {`# Python (requests)
import os, requests

response = requests.post(
    "https://YOUR_DOMAIN/api/v1/messages/bulk",
    headers={"Authorization": f"Bearer {os.environ['HANSARIA_API_KEY']}"},
    json={
        "adminUserId": os.environ["HANSARIA_ADMIN_ID"],
        "adminPassword": os.environ["HANSARIA_ADMIN_PASSWORD"],
        "templateId": "${template._id}",
        "recipients": [
            {"toUserId": "USER_ID_1", "language": "hi", "variables": ${JSON.stringify(variables)}},
            {"toUserId": "USER_ID_2", "language": "bn", "variables": ${JSON.stringify(variables)}},
        ],
    },
    timeout=30,
)
response.raise_for_status()
print(response.json()["sent"])`}
                  </pre>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3">
                    {`<?php
// PHP (cURL)
$payload = [
  "adminUserId" => getenv("HANSARIA_ADMIN_ID"),
  "adminPassword" => getenv("HANSARIA_ADMIN_PASSWORD"),
  "templateId" => "${template._id}",
  "recipients" => [
    ["toUserId" => "USER_ID_1", "language" => "hi", "variables" => [${phpVariables}]],
    ["toUserId" => "USER_ID_2", "language" => "bn", "variables" => [${phpVariables}]]
  ]
];
$ch = curl_init("https://YOUR_DOMAIN/api/v1/messages/bulk");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("HANSARIA_API_KEY"),
    "Content-Type: application/json"
  ],
  CURLOPT_POSTFIELDS => json_encode($payload),
  CURLOPT_RETURNTRANSFER => true
]);
$result = curl_exec($ch);
if ($result === false) throw new RuntimeException(curl_error($ch));
curl_close($ch);
echo $result;`}
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
                    Regular-admin credentials and API keys can only use
                    templates in their own workspace. Super-admin keys can
                    use templates across workspaces. For single sends,
                    fromUserId must be an account created by this admin unless
                    the API key is already bound to a sender.
                  </p>
                </div>
              </details>
            </div>
          );
        })}
        {!visibleTemplates.length && (
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
  companyName,
  setCompanyName,
  companyDomain,
  setCompanyDomain,
  companyVerificationRequested,
  isCompanyVerified,
  password,
  setPassword,
  isSaving,
  onSave,
}: {
  userId: string;
  email: string;
  setEmail: (value: SetStateAction<string>) => void;
  companyName: string;
  setCompanyName: (value: SetStateAction<string>) => void;
  companyDomain: string;
  setCompanyDomain: (value: SetStateAction<string>) => void;
  companyVerificationRequested: boolean;
  isCompanyVerified: boolean;
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
        htmlFor="admin-company-name"
        className="mt-5 block text-sm font-medium text-gray-700"
      >
        Company display name
      </label>
      <input
        id="admin-company-name"
        value={companyName}
        onChange={(event) => setCompanyName(event.target.value)}
        maxLength={100}
        className={adminFieldClass}
        placeholder="Registered company name"
      />
      <label
        htmlFor="admin-company-domain"
        className="mt-4 block text-sm font-medium text-gray-700"
      >
        Company website domain
      </label>
      <input
        id="admin-company-domain"
        value={companyDomain}
        onChange={(event) => setCompanyDomain(event.target.value)}
        maxLength={253}
        className={adminFieldClass}
        placeholder="example.com"
      />
      <p className="mt-2 text-xs text-slate-500">
        Save your company name and domain to request super-admin verification.
        Only approved businesses show a verified badge to chat recipients.
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-600">
        Verification: {isCompanyVerified ? "Approved" : companyVerificationRequested ? "Pending review" : "Not verified"}
      </p>
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
