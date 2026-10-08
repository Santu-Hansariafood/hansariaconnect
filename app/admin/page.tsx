"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";
import AdminApplicationConnectionGuide from "@/components/admin/AdminApplicationConnectionGuide";
import BulkAccountsModal, {
  type BulkUserInput,
} from "@/components/admin/BulkAccountsModal";
import AdminAccessPanel, {
  type AdminAccount,
} from "@/components/admin/AdminAccessPanel";
import AdminUsersPanel, {
  type AdminDirectoryUser,
  type AdminUserPagination,
  type AdminUserPermissions,
} from "@/components/admin/AdminUsersPanel";
import {
  AccountRegistrationPanel,
  AdminProfilePanel,
  AdminTemplatesPanel,
} from "@/components/admin/AdminWorkspacePanels";
import { ACCOUNT_TEMPLATE_HEADERS } from "@/components/admin/adminConstants";
import type { TemplateActionButton } from "@/lib/templateActionButtons";

type Permission = AdminUserPermissions;
type UserRow = AdminDirectoryUser;
type UserPagination = AdminUserPagination;

type AdminRow = AdminAccount;
type AdminTemplateRow = {
  _id: string;
  name: string;
  body: string;
  header?: string;
  footer?: string;
  defaultLanguage?: string;
  folder?: string;
  translations?: Record<string, string>;
  buttons?: TemplateActionButton[];
  ownerUserId?: string;
};

type ApiKeyRow = {
  _id: string;
  adminId: string;
  ownerUserId: string;
  name: string;
  permissions: {
    sendMessage: boolean;
    readMessages: boolean;
    manageContacts: boolean;
  };
  sentCount: number;
  lastUsed?: string;
  expiresAt?: string;
  isActive: boolean;
  createdAt: string;
  senderUserId?: string;
};

export default function AdminDashboard() {
  const router = useRouter();
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadSequence = useRef(0);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [userPagination, setUserPagination] = useState<UserPagination>({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 1,
  });
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSuperSubdomain, setIsSuperSubdomain] = useState(false);
  const isPlatformAdmin = isSuperAdmin || isSuperSubdomain;
  const [browserNotificationPermission, setBrowserNotificationPermission] =
    useState<NotificationPermission | "unsupported">(() =>
      typeof window !== "undefined" && "Notification" in window
        ? Notification.permission
        : "unsupported",
    );
  const [activeTab, setActiveTab] = useState<
    "users" | "admins" | "api-keys" | "accounts" | "templates" | "profile"
  >("users");
  const [templates, setTemplates] = useState<AdminTemplateRow[]>([]);
  const [ownerAdminId, setOwnerAdminId] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [templateHeader, setTemplateHeader] = useState("");
  const [templateFooter, setTemplateFooter] = useState("");
  const [templateButtons, setTemplateButtons] = useState<TemplateActionButton[]>([]);
  const [templateDefaultLanguage, setTemplateDefaultLanguage] = useState("en");
  const [templateFolder, setTemplateFolder] = useState("General");
  const [templateTranslations, setTemplateTranslations] = useState<
    Record<string, string>
  >({});
  const [newTranslationLanguage, setNewTranslationLanguage] = useState("hi");
  const [editingTemplate, setEditingTemplate] =
    useState<AdminTemplateRow | null>(null);
  const [editingTemplateName, setEditingTemplateName] = useState("");
  const [editingTemplateBody, setEditingTemplateBody] = useState("");
  const [editingTemplateHeader, setEditingTemplateHeader] = useState("");
  const [editingTemplateFooter, setEditingTemplateFooter] = useState("");
  const [editingTemplateButtons, setEditingTemplateButtons] = useState<
    TemplateActionButton[]
  >([]);
  const [editingTemplateDefaultLanguage, setEditingTemplateDefaultLanguage] =
    useState("en");
  const [editingTemplateFolder, setEditingTemplateFolder] = useState("");
  const [editingTemplateTranslations, setEditingTemplateTranslations] =
    useState<Record<string, string>>({});
  const [adminProfile, setAdminProfile] = useState({
    adminId: "",
    userId: "",
    email: "",
    isSuperAdmin: false,
    companyName: "",
    companyDomain: "",
    companyVerificationRequested: false,
    isCompanyVerified: false,
  });
  const currentAdminId =
    adminProfile.adminId ||
    admins.find((admin) => admin.userId === adminProfile.userId)?._id ||
    "";
  const effectiveKeyOwnerId = ownerAdminId || currentAdminId;
  const effectiveKeyOwnerCount = apiKeys.filter(
    (apiKey) => apiKey.adminId === effectiveKeyOwnerId,
  ).length;
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileCompanyName, setProfileCompanyName] = useState("");
  const [profileCompanyDomain, setProfileCompanyDomain] = useState("");
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiresDays, setNewApiKeyExpiresDays] = useState("");
  const [newApiKeySenderUserId, setNewApiKeySenderUserId] = useState("");
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(
    null,
  );

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [createAdminError, setCreateAdminError] = useState("");
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminIsSuper, setNewAdminIsSuper] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [editAdminUserId, setEditAdminUserId] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminIsSuper, setEditAdminIsSuper] = useState(false);
  const [editAdminCompanyName, setEditAdminCompanyName] = useState("");
  const [editAdminCompanyDomain, setEditAdminCompanyDomain] = useState("");
  const [editAdminCompanyVerified, setEditAdminCompanyVerified] =
    useState(false);
  const [showBulkUsers, setShowBulkUsers] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<BulkUserInput[]>([]);
  const [bulkUsersFileName, setBulkUsersFileName] = useState("");
  const bulkUsersFileInput = useRef<HTMLInputElement>(null);

  const loadData = useCallback(
    async (userPage: number, canManageUsers: boolean) => {
      const requestId = ++loadSequence.current;
      setRefreshing(true);
      setError("");
      try {
        const [usersRes, adminsRes, apiKeysRes, templatesRes, profileRes] =
          await Promise.all([
            canManageUsers
              ? fetch(`/api/admin/users?page=${userPage}`, {
                  cache: "no-store",
                })
              : Promise.resolve(null),
            canManageUsers
              ? fetch("/api/admin/admins", { cache: "no-store" })
              : Promise.resolve(null),
            fetch("/api/admin/api-keys", { cache: "no-store" }),
            fetch("/api/admin/templates", { cache: "no-store" }),
            fetch("/api/admin/profile", { cache: "no-store" }),
          ]);

        if (
          [usersRes, adminsRes, apiKeysRes, templatesRes, profileRes].some(
            (response) => response?.status === 401,
          )
        ) {
          router.replace("/admin/login");
          return;
        }

        const [usersData, adminsData, apiKeysData, templatesData, profileData] =
          await Promise.all([
            usersRes?.json(),
            adminsRes?.json(),
            apiKeysRes.json(),
            templatesRes.json(),
            profileRes.json(),
          ]);

        if (requestId !== loadSequence.current) return;

        const loadErrors: string[] = [];
        if (usersRes && usersRes.ok) {
          setUsers(usersData?.users || []);
          setUserPagination((previous) => usersData?.pagination || previous);
        } else if (usersRes && !usersRes.ok) {
          loadErrors.push(usersData?.error || "Failed to load users");
        }

        if (adminsRes?.ok) {
          setAdmins(adminsData?.admins || []);
        } else if (adminsRes && !adminsRes.ok) {
          loadErrors.push(adminsData?.error || "Failed to load admins");
        }

        if (apiKeysRes.ok) {
          setApiKeys(apiKeysData?.apiKeys || []);
        } else {
          loadErrors.push(apiKeysData?.error || "Failed to load API keys");
        }

        if (templatesRes.ok) {
          setTemplates(templatesData?.templates || []);
        } else {
          loadErrors.push(templatesData?.error || "Failed to load templates");
        }

        if (profileRes.ok && profileData?.profile) {
          setAdminProfile(profileData.profile);
          setProfileEmail(profileData.profile.email || "");
          setProfileCompanyName(profileData.profile.companyName || "");
          setProfileCompanyDomain(profileData.profile.companyDomain || "");
        } else if (!profileRes.ok) {
          loadErrors.push(profileData?.error || "Failed to load admin profile");
        }

        setError(loadErrors[0] || "");
      } catch (error) {
        if (requestId === loadSequence.current) {
          console.error(
            "[AdminDashboard] Failed to load dashboard data:",
            error,
          );
          setError(
            "Dashboard data could not be refreshed. Check your connection.",
          );
        }
      } finally {
        if (requestId === loadSequence.current) setRefreshing(false);
      }
    },
    [router],
  );

  const refreshData = useCallback(
    (userPage = userPagination.page) =>
      loadData(userPage, isSuperAdmin || isSuperSubdomain),
    [isSuperAdmin, isSuperSubdomain, loadData, userPagination.page],
  );

  useEffect(() => {
    const checkSession = async () => {
      const superSubdomain = /^super\./i.test(window.location.host);
      setIsSuperSubdomain(superSubdomain);
      try {
        const res = await fetch("/api/admin/me", {
          cache: "no-store",
        });

        if (!res.ok) {
          router.replace("/admin/login");
          return;
        }

        const data = await res.json();
        if (!data.success) {
          router.replace("/admin/login");
          return;
        }

        setIsSuperAdmin(data.admin.isSuperAdmin);
        setAdminProfile(data.admin);
        setProfileEmail(data.admin.email || "");
        const canManageUsers = data.admin.isSuperAdmin || superSubdomain;
        setActiveTab(canManageUsers ? "users" : "accounts");

        if (superSubdomain && !data.admin.isSuperAdmin) {
          router.replace("/admin/login");
          return;
        }

        await loadData(1, canManageUsers);
      } catch {
        router.replace("/admin/login");
      } finally {
        setInitialLoading(false);
      }
    };

    void checkSession();
  }, [loadData, router]);

  const requestBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setBrowserNotificationPermission("unsupported");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setBrowserNotificationPermission(permission);
    } catch (permissionError) {
      console.error(
        "[AdminDashboard] Browser notification permission request failed:",
        permissionError,
      );
      setError("Could not request browser notification permission.");
    }
  };

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving("template");
    setError("");
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          body: templateBody,
          header: templateHeader,
          footer: templateFooter,
          buttons: templateButtons,
          defaultLanguage: templateDefaultLanguage,
          folder: templateFolder,
          translations: templateTranslations,
          adminId: ownerAdminId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create template");
      setTemplates((previous) => [data.template, ...previous]);
      setTemplateName("");
      setTemplateBody("");
      setTemplateHeader("");
      setTemplateFooter("");
      setTemplateButtons([]);
      setTemplateTranslations({});
    } catch (error: any) {
      setError(error?.message || "Failed to create template");
    } finally {
      setSaving(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    setError("");
    try {
      const res = await fetch(`/api/admin/templates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete template");
      setTemplates((previous) =>
        previous.filter((template) => template._id !== id),
      );
    } catch (error) {
      console.error("[AdminDashboard] Failed to delete template:", error);
      setError(
        error instanceof Error ? error.message : "Failed to delete template",
      );
    }
  };

  const updateTemplate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingTemplate) return;
    setSaving("template");
    setError("");
    try {
      const res = await fetch(
        `/api/admin/templates/${editingTemplate._id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: editingTemplateName,
            body: editingTemplateBody,
            header: editingTemplateHeader,
            footer: editingTemplateFooter,
            buttons: editingTemplateButtons,
            defaultLanguage: editingTemplateDefaultLanguage,
            folder: editingTemplateFolder,
            translations: editingTemplateTranslations,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to update template");
      setTemplates((previous) =>
        previous.map((template) =>
          template._id === editingTemplate._id
            ? { ...template, ...data.template }
            : template,
        ),
      );
      setEditingTemplate(null);
    } catch (error) {
      console.error("[AdminDashboard] Failed to update template:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update template",
      );
    } finally {
      setSaving(null);
    }
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving("profile");
    setError("");
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: profileEmail,
          password: profilePassword || undefined,
          companyName: profileCompanyName,
          companyDomain: profileCompanyDomain,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save profile");
      setAdminProfile(data.profile);
      setProfilePassword("");
    } catch (error: any) {
      setError(error?.message || "Failed to save profile");
    } finally {
      setSaving(null);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving("create-api-key");
    try {
      const res = await fetch("/api/admin/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newApiKeyName,
          adminId: ownerAdminId || undefined,
          senderUserId: newApiKeySenderUserId.trim() || undefined,
          expiresDays: newApiKeyExpiresDays
            ? parseInt(newApiKeyExpiresDays)
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create API key");
        return;
      }
      setNewlyCreatedApiKey(data.apiKey.key);
      setShowCreateApiKey(false);
      setNewApiKeyName("");
      setNewApiKeyExpiresDays("");
      setNewApiKeySenderUserId("");
      void refreshData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  };

  const handleCreateBulkUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving("create-users");
    try {
      if (!bulkUsers.length)
        throw new Error("Upload an Excel template with at least one account");
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users: bulkUsers }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create accounts");
      setBulkUsers([]);
      setBulkUsersFileName("");
      if (bulkUsersFileInput.current) bulkUsersFileInput.current.value = "";
      setShowBulkUsers(false);
      void loadData(1, true);
    } catch (error: any) {
      setError(error?.message || "Failed to create accounts");
    } finally {
      setSaving(null);
    }
  };

  const handleDownloadAccountTemplate = async () => {
    try {
      const blob = await writeXlsxFile([[...ACCOUNT_TEMPLATE_HEADERS]], {
        sheet: "Accounts",
        columns: [{ width: 28 }, { width: 36 }, { width: 18 }],
      }).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "account-registration-template.xlsx";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Failed to create the Excel template",
      );
    }
  };

  const handleAccountSheetUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    setBulkUsers([]);
    setBulkUsersFileName("");
    setError("");
    if (!file) return;

    try {
      const rows = await readSheet(file, "Accounts");
      const header = rows[0]
        ?.slice(0, ACCOUNT_TEMPLATE_HEADERS.length)
        .map((cell) =>
          String(cell ?? "")
            .trim()
            .toLowerCase(),
        );
      if (
        !header ||
        header.length !== ACCOUNT_TEMPLATE_HEADERS.length ||
        !ACCOUNT_TEMPLATE_HEADERS.every(
          (value, index) => header[index] === value.toLowerCase(),
        ) ||
        rows[0]
          .slice(ACCOUNT_TEMPLATE_HEADERS.length)
          .some((cell) => String(cell ?? "").trim())
      ) {
        throw new Error(
          "Use the admin template with columns: Name, Email, Mobile",
        );
      }

      const users: BulkUserInput[] = [];
      for (const [index, row] of rows.slice(1).entries()) {
        if (row.every((cell) => !String(cell ?? "").trim())) continue;
        if (
          row
            .slice(ACCOUNT_TEMPLATE_HEADERS.length)
            .some((cell) => String(cell ?? "").trim())
        ) {
          throw new Error(
            `Row ${index + 2} has extra columns. Use the admin template.`,
          );
        }
        const [name, email, mobile] = row
          .slice(0, ACCOUNT_TEMPLATE_HEADERS.length)
          .map((cell) => String(cell ?? "").trim());
        if (!name || !email || !mobile) {
          throw new Error(
            `Complete Name, Email, and Mobile on row ${index + 2}`,
          );
        }
        users.push({ name, email, mobile });
      }

      if (!users.length)
        throw new Error("Add at least one account to the Excel sheet");
      if (users.length > 100)
        throw new Error("Upload no more than 100 accounts at a time");

      setBulkUsers(users);
      setBulkUsersFileName(file.name);
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Failed to read the Excel file",
      );
    }
  };

  const handleToggleApiKeyActive = async (id: string, isActive: boolean) => {
    setSaving(id);
    try {
      await fetch(`/api/admin/api-keys/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      void refreshData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteApiKey = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API key?")) return;
    setSaving(id);
    try {
      await fetch(`/api/admin/api-keys/${id}`, {
        method: "DELETE",
      });
      void refreshData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  };

  const updateUserPermissions = async (id: string, next: Permission) => {
    setSaving(id);
    try {
      const res = await fetch(`/api/admin/users/${id}/access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: next }),
      });
      const data = await res.json();
      if (res.ok && data?.permissions) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === id ? { ...u, permissions: data.permissions } : u,
          ),
        );
      }
    } finally {
      setSaving(null);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateAdminError("");
    setSaving("create");
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: newAdminUserId,
          email: newAdminEmail,
          password: newAdminPassword,
          isSuperAdmin: newAdminIsSuper,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateAdminError(data.error || "Failed to create admin");
        return;
      }
      setShowCreateAdmin(false);
      setCreateAdminError("");
      setNewAdminUserId("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminIsSuper(false);
      void refreshData();
    } catch {
      setCreateAdminError("Could not create admin. Check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  const handleUpdateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setError("");
    setSaving(editingAdmin._id);
    try {
      const updateData: Record<string, string | boolean> = {};
      if (editAdminUserId !== editingAdmin.userId)
        updateData.userId = editAdminUserId;
      if (editAdminEmail !== editingAdmin.email)
        updateData.email = editAdminEmail;
      if (editAdminPassword) updateData.password = editAdminPassword;
      if (editAdminIsSuper !== editingAdmin.isSuperAdmin)
        updateData.isSuperAdmin = editAdminIsSuper;
      if (editAdminCompanyName !== (editingAdmin.companyName || ""))
        updateData.companyName = editAdminCompanyName;
      if (editAdminCompanyDomain !== (editingAdmin.companyDomain || ""))
        updateData.companyDomain = editAdminCompanyDomain;
      if (editAdminCompanyVerified !== Boolean(editingAdmin.isCompanyVerified))
        updateData.isCompanyVerified = editAdminCompanyVerified;

      const res = await fetch(`/api/admin/admins/${editingAdmin._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update admin");
        return;
      }
      setEditingAdmin(null);
      void refreshData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  };

  const handleDeleteAdmin = async (adminId: string) => {
    if (!confirm("Are you sure you want to delete this admin?")) return;
    setError("");
    setSaving(adminId);
    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete admin");
        return;
      }
      void refreshData();
    } catch {
      setError("Network error");
    } finally {
      setSaving(null);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {}
    router.replace("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header
        className={`sticky top-0 z-30 border-b shadow-sm backdrop-blur ${
          isPlatformAdmin
            ? "border-indigo-900/20 bg-slate-950/95"
            : "border-emerald-900/10 bg-white/95"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black tracking-wide text-white shadow-md ${
                isPlatformAdmin
                  ? "bg-indigo-500 shadow-indigo-950/30"
                  : "bg-emerald-700 shadow-emerald-900/20"
              }`}
            >
              HC
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className={`truncate text-base font-bold sm:text-lg ${
                    isPlatformAdmin ? "text-white" : "text-slate-900"
                  }`}
                >
                  {isPlatformAdmin ? "Super Admin Console" : "Admin Workspace"}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ${
                    isPlatformAdmin
                      ? "bg-indigo-400/15 text-indigo-100 ring-indigo-300/25"
                      : "bg-emerald-50 text-emerald-800 ring-emerald-700/10"
                  }`}
                >
                  {isPlatformAdmin ? "Platform admin" : "Workspace admin"}
                </span>
              </div>
              <p
                className={`hidden truncate text-xs sm:block ${
                  isPlatformAdmin ? "text-slate-300" : "text-slate-500"
                }`}
              >
                {adminProfile.email ||
                  adminProfile.userId ||
                  "HansariaConnect control center"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`hidden items-center gap-2 text-xs transition-opacity sm:flex ${
                isPlatformAdmin ? "text-slate-300" : "text-slate-500"
              } ${
                refreshing ? "opacity-100" : "opacity-0"
              }`}
              role="status"
              aria-live="polite"
            >
              <span
                className={`h-2 w-2 animate-pulse rounded-full ${
                  isPlatformAdmin ? "bg-indigo-400" : "bg-emerald-500"
                }`}
              />
              Updating
            </span>
            <button
              onClick={logout}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 sm:px-4 ${
                isPlatformAdmin
                  ? "border-white/15 bg-white/10 text-white hover:border-rose-300/40 hover:bg-rose-500/15 hover:text-rose-100"
                  : "border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
              }`}
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
        {initialLoading ? (
          <div
            className="space-y-5"
            role="status"
            aria-label="Loading admin workspace"
          >
            <div className="h-9 w-56 animate-pulse rounded-xl bg-slate-200" />
            <div className="h-12 animate-pulse rounded-2xl bg-slate-200" />
            <div className="h-72 animate-pulse rounded-2xl bg-white shadow-sm" />
          </div>
        ) : (
          <>
            <section
              className={`mb-6 overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-7 ${
                isPlatformAdmin
                  ? "border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800 text-white"
                  : "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-teal-100 text-slate-900"
              }`}
              aria-labelledby="workspace-title"
            >
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p
                    className={`text-xs font-bold uppercase tracking-[0.18em] ${
                      isPlatformAdmin ? "text-indigo-200" : "text-emerald-800"
                    }`}
                  >
                    {isPlatformAdmin
                      ? "Platform administration"
                      : "Private admin workspace"}
                  </p>
                  <h2
                    id="workspace-title"
                    className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
                  >
                    {isPlatformAdmin
                      ? "Platform overview"
                      : `Welcome${adminProfile.userId ? `, ${adminProfile.userId}` : ""}`}
                  </h2>
                  <p
                    className={`mt-2 text-sm leading-6 sm:text-base ${
                      isPlatformAdmin ? "text-slate-300" : "text-slate-600"
                    }`}
                  >
                    {isPlatformAdmin
                      ? "Manage platform users, admins, templates, and API keys across all workspaces."
                      : "Manage the accounts, message templates, and API integrations belonging to this admin workspace. Super Admin platform controls are separate."}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {browserNotificationPermission === "granted" ? (
                      <span
                        className={`inline-flex items-center gap-2 text-sm font-medium ${
                          isPlatformAdmin
                            ? "text-emerald-200"
                            : "text-emerald-800"
                        }`}
                        role="status"
                      >
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Browser notification permission is enabled
                      </span>
                    ) : browserNotificationPermission === "default" ? (
                      <button
                        type="button"
                        onClick={() => void requestBrowserNotifications()}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          isPlatformAdmin
                            ? "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15"
                            : "bg-white text-emerald-900 ring-1 ring-emerald-900/10 hover:bg-emerald-50"
                        }`}
                      >
                        Enable browser notifications
                      </button>
                    ) : browserNotificationPermission === "denied" ? (
                      <span
                        className={`text-sm ${
                          isPlatformAdmin
                            ? "text-amber-200"
                            : "text-amber-800"
                        }`}
                        role="status"
                      >
                        Notifications are blocked in browser settings. Allow
                        them for this site to receive desktop alerts.
                      </span>
                    ) : (
                      <span
                        className={`text-sm ${
                          isPlatformAdmin
                            ? "text-slate-300"
                            : "text-slate-500"
                        }`}
                        role="status"
                      >
                        Browser notifications are not supported here.
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[430px]">
                  {(isPlatformAdmin
                    ? [
                        {
                          label: "Platform users",
                          value: userPagination.total,
                        },
                        { label: "Admin accounts", value: admins.length },
                        {
                          label: "My templates",
                          value: templates.length,
                        },
                      ]
                    : [
                        { label: "My templates", value: templates.length },
                        { label: "My API keys", value: apiKeys.length },
                        {
                          label: "Active keys",
                          value: apiKeys.filter((key) => key.isActive).length,
                        },
                      ]
                  ).map((stat) => (
                    <div
                      key={stat.label}
                      className={`rounded-2xl border px-4 py-3 ${
                        isPlatformAdmin
                          ? "border-white/10 bg-white/5"
                          : "border-white/80 bg-white/75 shadow-sm"
                      }`}
                    >
                      <p
                        className={`text-xs font-medium ${
                          isPlatformAdmin ? "text-slate-300" : "text-slate-500"
                        }`}
                      >
                        {stat.label}
                      </p>
                      <p className="mt-1 text-2xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              {!isPlatformAdmin && (
                <p className="mt-5 border-t border-emerald-900/10 pt-4 text-xs text-slate-500">
                  Workspace owner:{" "}
                  <span className="font-semibold text-slate-700">
                    {adminProfile.email || adminProfile.userId}
                  </span>
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800">
                    {isPlatformAdmin ? "All workspaces" : "Private to this admin"}
                  </span>
                </p>
              )}
            </section>
            {error && (
              <div
                role="alert"
                className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  className="shrink-0 font-semibold text-rose-700 hover:text-rose-900"
                  aria-label="Dismiss error"
                >
                  Dismiss
                </button>
              </div>
            )}

            <nav
              aria-label={isPlatformAdmin ? "Super Admin sections" : "Admin workspace sections"}
              className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              {isPlatformAdmin ? (
                <div>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700">
                    Platform controls
                  </p>
                  <div className="flex gap-1 overflow-x-auto">
                    <button
                      onClick={() => setActiveTab("users")}
                      aria-current={activeTab === "users" ? "page" : undefined}
                      className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        activeTab === "users"
                          ? "bg-indigo-700 text-white shadow-md shadow-indigo-900/15"
                          : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                      }`}
                    >
                      User directory
                    </button>
                    <button
                      onClick={() => setActiveTab("admins")}
                      aria-current={activeTab === "admins" ? "page" : undefined}
                      className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        activeTab === "admins"
                          ? "bg-indigo-700 text-white shadow-md shadow-indigo-900/15"
                          : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                      }`}
                    >
                      Admin access
                    </button>
                    <button
                      onClick={() => setActiveTab("templates")}
                      aria-current={
                        activeTab === "templates" ? "page" : undefined
                      }
                      className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                        activeTab === "templates"
                          ? "bg-indigo-700 text-white shadow-md shadow-indigo-900/15"
                          : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                      }`}
                    >
                      My templates
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">
                    Workspace tools
                  </p>
                  <div className="flex gap-1 overflow-x-auto">
                  <button
                    onClick={() => setActiveTab("accounts")}
                    aria-current={activeTab === "accounts" ? "page" : undefined}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "accounts" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"}`}
                  >
                    Accounts
                  </button>
                  <button
                    onClick={() => setActiveTab("templates")}
                    aria-current={activeTab === "templates" ? "page" : undefined}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "templates" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"}`}
                  >
                    Templates
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    aria-current={activeTab === "profile" ? "page" : undefined}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "profile" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"}`}
                  >
                    Profile
                  </button>
                  </div>
                </div>
              )}
              <div
                className={`border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0 ${
                  isPlatformAdmin
                    ? "border-indigo-100"
                    : "border-emerald-100"
                }`}
              >
                <p
                  className={`mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] ${
                    isPlatformAdmin ? "text-indigo-700" : "text-emerald-800"
                  }`}
                >
                  {isPlatformAdmin ? "Personal integrations" : "Integrations"}
                </p>
                <button
                  onClick={() => setActiveTab("api-keys")}
                  aria-current={activeTab === "api-keys" ? "page" : undefined}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === "api-keys"
                      ? `${
                          isPlatformAdmin ? "bg-indigo-700" : "bg-emerald-700"
                        } text-white shadow-md`
                      : isPlatformAdmin
                        ? "text-slate-600 hover:bg-indigo-50 hover:text-indigo-800"
                        : "text-slate-600 hover:bg-emerald-50 hover:text-emerald-800"
                  }`}
                >
                  API Keys
                </button>
              </div>
            </nav>

            {showBulkUsers && (
              <BulkAccountsModal
                isPlatformAdmin={isPlatformAdmin}
                error={error}
                accounts={bulkUsers}
                fileName={bulkUsersFileName}
                fileInputRef={bulkUsersFileInput}
                isSaving={saving === "create-users"}
                onDismissError={() => setError("")}
                onClose={() => {
                  setShowBulkUsers(false);
                  setBulkUsers([]);
                  setBulkUsersFileName("");
                  setError("");
                  if (bulkUsersFileInput.current)
                    bulkUsersFileInput.current.value = "";
                }}
                onDownloadTemplate={handleDownloadAccountTemplate}
                onUpload={handleAccountSheetUpload}
                onSubmit={handleCreateBulkUsers}
              />
            )}

            {activeTab === "accounts" && !isSuperAdmin && !isSuperSubdomain && (
              <AccountRegistrationPanel
                onRegisterAccounts={() => {
                  setError("");
                  setShowBulkUsers(true);
                }}
              />
            )}

            {activeTab === "templates" && (
              <AdminTemplatesPanel
                isPlatformAdmin={isPlatformAdmin}
                admins={admins}
                currentAdminUserId={adminProfile.userId}
                ownerAdminId={ownerAdminId}
                setOwnerAdminId={setOwnerAdminId}
                templates={templates}
                templateName={templateName}
                setTemplateName={setTemplateName}
                templateBody={templateBody}
                setTemplateBody={setTemplateBody}
                templateHeader={templateHeader}
                setTemplateHeader={setTemplateHeader}
                templateFooter={templateFooter}
                setTemplateFooter={setTemplateFooter}
                templateButtons={templateButtons}
                setTemplateButtons={setTemplateButtons}
                editingTemplateId={editingTemplate?._id || null}
                editingTemplateName={editingTemplateName}
                setEditingTemplateName={setEditingTemplateName}
                editingTemplateBody={editingTemplateBody}
                setEditingTemplateBody={setEditingTemplateBody}
                editingTemplateHeader={editingTemplateHeader}
                setEditingTemplateHeader={setEditingTemplateHeader}
                editingTemplateFooter={editingTemplateFooter}
                setEditingTemplateFooter={setEditingTemplateFooter}
                editingTemplateButtons={editingTemplateButtons}
                setEditingTemplateButtons={setEditingTemplateButtons}
                isSaving={saving === "template"}
                onCreate={createTemplate}
                onEdit={(template) => {
                  setEditingTemplate(template);
                  setEditingTemplateName(template.name);
                  setEditingTemplateBody(template.body);
                  setEditingTemplateHeader(template.header || "");
                  setEditingTemplateFooter(template.footer || "");
                  setEditingTemplateButtons(template.buttons || []);
                  setEditingTemplateDefaultLanguage(
                    template.defaultLanguage || "en",
                  );
                  setEditingTemplateFolder(template.folder || "General");
                  setEditingTemplateTranslations(
                    template.translations || {},
                  );
                }}
                onCancelEdit={() => setEditingTemplate(null)}
                onUpdate={updateTemplate}
                onDelete={deleteTemplate}
                folder={templateFolder}
                setFolder={setTemplateFolder}
                defaultLanguage={templateDefaultLanguage}
                setDefaultLanguage={setTemplateDefaultLanguage}
                translations={templateTranslations}
                setTranslations={setTemplateTranslations}
                newTranslationLanguage={newTranslationLanguage}
                setNewTranslationLanguage={setNewTranslationLanguage}
                onAddTranslation={() => {
                  setTemplateTranslations((previous) => ({
                    ...previous,
                    [newTranslationLanguage]: previous[newTranslationLanguage] || "",
                  }));
                }}
                editingFolder={editingTemplateFolder}
                setEditingFolder={setEditingTemplateFolder}
                editingDefaultLanguage={editingTemplateDefaultLanguage}
                setEditingDefaultLanguage={setEditingTemplateDefaultLanguage}
                editingTranslations={editingTemplateTranslations}
                setEditingTranslations={setEditingTemplateTranslations}
              />
            )}

            {activeTab === "profile" && !isSuperAdmin && !isSuperSubdomain && (
              <AdminProfilePanel
                userId={adminProfile.userId}
                email={profileEmail}
                setEmail={setProfileEmail}
                companyName={profileCompanyName}
                setCompanyName={setProfileCompanyName}
                companyDomain={profileCompanyDomain}
                setCompanyDomain={setProfileCompanyDomain}
                companyVerificationRequested={
                  adminProfile.companyVerificationRequested
                }
                isCompanyVerified={adminProfile.isCompanyVerified}
                password={profilePassword}
                setPassword={setProfilePassword}
                isSaving={saving === "profile"}
                onSave={saveProfile}
              />
            )}

            {/* Users Tab (Super Admin Only) */}
            {activeTab === "users" && (isSuperAdmin || isSuperSubdomain) && (
              <AdminUsersPanel
                users={users}
                pagination={userPagination}
                refreshing={refreshing}
                savingId={saving}
                selectedUser={selectedUser}
                setSelectedUser={setSelectedUser}
                onRegisterAccounts={() => {
                  setError("");
                  setShowBulkUsers(true);
                }}
                onPageChange={(page) => void refreshData(page)}
                onSavePermissions={updateUserPermissions}
              />
            )}

            {activeTab === "admins" && (isSuperAdmin || isSuperSubdomain) && (
              <AdminAccessPanel
                admins={admins}
                saving={saving}
                showCreate={showCreateAdmin}
                setShowCreate={(value) => {
                  setShowCreateAdmin(value);
                  setCreateAdminError("");
                }}
                createError={createAdminError}
                newUserId={newAdminUserId}
                setNewUserId={setNewAdminUserId}
                newEmail={newAdminEmail}
                setNewEmail={setNewAdminEmail}
                newPassword={newAdminPassword}
                setNewPassword={setNewAdminPassword}
                newIsSuperAdmin={newAdminIsSuper}
                setNewIsSuperAdmin={setNewAdminIsSuper}
                onCreate={handleCreateAdmin}
                editingAdmin={editingAdmin}
                onEdit={(admin) => {
                  setEditingAdmin(admin);
                  setEditAdminUserId(admin.userId);
                  setEditAdminEmail(admin.email);
                  setEditAdminPassword("");
                  setEditAdminIsSuper(admin.isSuperAdmin);
                  setEditAdminCompanyName(admin.companyName || "");
                  setEditAdminCompanyDomain(admin.companyDomain || "");
                  setEditAdminCompanyVerified(
                    Boolean(admin.isCompanyVerified),
                  );
                }}
                onCloseEdit={() => setEditingAdmin(null)}
                editUserId={editAdminUserId}
                setEditUserId={setEditAdminUserId}
                editEmail={editAdminEmail}
                setEditEmail={setEditAdminEmail}
                editPassword={editAdminPassword}
                setEditPassword={setEditAdminPassword}
                editIsSuperAdmin={editAdminIsSuper}
                setEditIsSuperAdmin={setEditAdminIsSuper}
                editCompanyName={editAdminCompanyName}
                setEditCompanyName={setEditAdminCompanyName}
                editCompanyDomain={editAdminCompanyDomain}
                setEditCompanyDomain={setEditAdminCompanyDomain}
                editCompanyVerified={editAdminCompanyVerified}
                setEditCompanyVerified={setEditAdminCompanyVerified}
                onUpdate={handleUpdateAdmin}
                onDelete={handleDeleteAdmin}
              />
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-4">
                <section
                  className={`overflow-hidden rounded-3xl border p-5 shadow-sm sm:p-7 ${
                    isPlatformAdmin
                      ? "border-indigo-200 bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-800 text-white"
                      : "border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-teal-100 text-slate-900"
                  }`}
                >
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p
                        className={`text-xs font-bold uppercase tracking-[0.18em] ${
                          isPlatformAdmin
                            ? "text-indigo-200"
                            : "text-emerald-800"
                        }`}
                      >
                        Secure integrations
                      </p>
                      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                        API keys
                      </h2>
                      <p
                        className={`mt-2 max-w-2xl text-sm leading-6 ${
                          isPlatformAdmin ? "text-slate-300" : "text-slate-600"
                        }`}
                      >
                        {isPlatformAdmin
                          ? "View and manage API keys across all admin workspaces."
                          : "Create and manage keys for this admin workspace. Each admin’s keys stay private."}
                      </p>
                    </div>
                    <button
                      onClick={() => setShowCreateApiKey(true)}
                      disabled={effectiveKeyOwnerCount >= 3}
                      className={`inline-flex shrink-0 items-center justify-center rounded-xl px-5 py-3 text-sm font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        isPlatformAdmin
                          ? "bg-indigo-400 text-slate-950 hover:bg-indigo-300 focus:ring-indigo-300"
                          : "bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-600"
                      } disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {effectiveKeyOwnerCount >= 3 ? "Key limit reached (3)" : "Create API key"}
                    </button>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isPlatformAdmin
                          ? "border-white/15 bg-white/5 text-slate-200"
                          : "border-emerald-900/10 bg-white/70 text-emerald-900"
                      }`}
                    >
                      {apiKeys.length} total key{apiKeys.length === 1 ? "" : "s"}
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isPlatformAdmin
                          ? "border-white/15 bg-white/5 text-slate-200"
                          : "border-emerald-900/10 bg-white/70 text-emerald-900"
                      }`}
                    >
                      {apiKeys.filter((apiKey) => apiKey.isActive).length} active
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isPlatformAdmin
                          ? "border-white/15 bg-white/5 text-slate-200"
                          : "border-emerald-900/10 bg-white/70 text-emerald-900"
                      }`}
                    >
                      {apiKeys.reduce((total, apiKey) => total + apiKey.sentCount, 0)} messages sent
                    </span>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                        isPlatformAdmin
                          ? "border-white/15 bg-white/5 text-slate-200"
                          : "border-emerald-900/10 bg-white/70 text-emerald-900"
                      }`}
                    >
                      {isPlatformAdmin ? "All workspaces" : "Private to this admin"}
                    </span>
                  </div>
                </section>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Keep API keys secret. Use them only from trusted servers over
                  HTTPS, and disable or delete any key that may have been
                  exposed.
                </div>
                <AdminApplicationConnectionGuide
                  isPlatformAdmin={isPlatformAdmin}
                  onNavigate={setActiveTab}
                  onCreateApiKey={() => setShowCreateApiKey(true)}
                />

                {newlyCreatedApiKey && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="api-key-created-title"
                      className="my-auto w-full max-w-xl rounded-3xl border border-emerald-100 bg-white p-6 shadow-2xl sm:p-8"
                    >
                      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-xl font-bold text-emerald-800">
                        ✓
                      </div>
                      <h3
                        id="api-key-created-title"
                        className="text-xl font-bold text-slate-900"
                      >
                        API key created
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Copy and store this key securely. It is shown only
                        once; you cannot retrieve it after closing this
                        message.
                      </p>
                      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Secret API key
                        </p>
                        <div className="break-all rounded-xl border border-slate-200 bg-white p-3 font-mono text-sm leading-6 text-slate-900">
                          {newlyCreatedApiKey}
                        </div>
                      </div>
                      <button
                        onClick={() => setNewlyCreatedApiKey(null)}
                        className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
                      >
                        I’ve saved my key
                      </button>
                    </section>
                  </div>
                )}

                {showCreateApiKey && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 backdrop-blur-sm">
                    <section
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="create-api-key-title"
                      className="my-auto w-full max-w-xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
                    >
                      <div
                        className={`rounded-t-3xl px-6 py-5 sm:px-8 ${
                          isPlatformAdmin
                            ? "bg-indigo-950 text-white"
                            : "bg-emerald-950 text-white"
                        }`}
                      >
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">
                          Secure integrations
                        </p>
                        <h3
                          id="create-api-key-title"
                          className="mt-1 text-xl font-bold"
                        >
                          Create an API key
                        </h3>
                        <p className="mt-1 text-sm text-white/75">
                          Configure access for a trusted server integration.
                        </p>
                      </div>
                      <form
                        onSubmit={handleCreateApiKey}
                        className="space-y-5 p-6 sm:p-8"
                      >
                        <div>
                          <label
                            htmlFor="api-key-name"
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Key name
                          </label>
                          <input
                            id="api-key-name"
                            type="text"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            value={newApiKeyName}
                            onChange={(e) => setNewApiKeyName(e.target.value)}
                            placeholder="e.g. Order notifications"
                            maxLength={100}
                            required
                          />
                          <p className="mt-1.5 text-xs text-slate-500">
                            Use a name that identifies the application or
                            purpose.
                          </p>
                        </div>
                        {isPlatformAdmin && (
                          <div>
                            <label
                              htmlFor="api-key-owner"
                              className="mb-1.5 block text-sm font-semibold text-slate-800"
                            >
                              Create key for admin
                            </label>
                            <select
                              id="api-key-owner"
                              value={ownerAdminId}
                              onChange={(event) =>
                                setOwnerAdminId(event.target.value)
                              }
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100"
                            >
                              <option value="">
                                Your Super Admin workspace
                              </option>
                              {admins
                                .filter(
                                  (admin) =>
                                    admin.userId !== adminProfile.userId,
                                )
                                .map((admin) => (
                                  <option key={admin._id} value={admin._id}>
                                    {admin.userId} workspace
                                  </option>
                                ))}
                            </select>
                            <p className="mt-1.5 text-xs text-slate-500">
                              The key counts toward the selected admin&apos;s
                              3-key limit.
                            </p>
                          </div>
                        )}
                        <div>
                          <label
                            htmlFor="api-key-sender"
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Sender chat account ID{" "}
                            <span className="font-normal text-slate-500">
                              (optional)
                            </span>
                          </label>
                          <input
                            id="api-key-sender"
                            type="text"
                            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            value={newApiKeySenderUserId}
                            onChange={(event) =>
                              setNewApiKeySenderUserId(event.target.value)
                            }
                            placeholder="Chat account ObjectId"
                          />
                          <p className="mt-1.5 text-xs leading-5 text-slate-500">
                            Bind the key to a chat account for bulk sends.
                            Leave blank when each single-send request supplies
                            its own fromUserId (the account must belong to this
                            admin).
                          </p>
                        </div>
                        <div>
                          <label
                            htmlFor="api-key-expiry"
                            className="mb-1.5 block text-sm font-semibold text-slate-800"
                          >
                            Expiration{" "}
                            <span className="font-normal text-slate-500">
                              (optional)
                            </span>
                          </label>
                          <div className="relative">
                            <input
                              id="api-key-expiry"
                              type="number"
                              className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-20 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                              value={newApiKeyExpiresDays}
                              onChange={(e) =>
                                setNewApiKeyExpiresDays(e.target.value)
                              }
                              placeholder="No expiry"
                              min="1"
                              max="3650"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">
                              days
                            </span>
                          </div>
                          <p className="mt-1.5 text-xs text-slate-500">
                            Leave blank for a key that does not expire
                            automatically.
                          </p>
                        </div>
                        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={() => setShowCreateApiKey(false)}
                            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={
                              saving === "create-api-key" ||
                              effectiveKeyOwnerCount >= 3
                            }
                            className={`rounded-xl px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              isPlatformAdmin
                                ? "bg-indigo-700 hover:bg-indigo-800 focus:ring-indigo-600"
                                : "bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-600"
                            }`}
                          >
                            {saving === "create-api-key"
                              ? "Creating key..."
                              : "Create API key"}
                          </button>
                        </div>
                      </form>
                    </section>
                  </div>
                )}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {isPlatformAdmin
                          ? "API keys across admin workspaces"
                          : "Your workspace keys"}
                      </h3>
                      <p className="mt-0.5 text-sm text-slate-500">
                        Each admin can have up to 3 keys. Sent counts are
                        tracked per key; disable or delete keys you no longer
                        use.
                      </p>
                    </div>
                    <span className="text-sm font-medium text-slate-500">
                      {apiKeys.length} total
                    </span>
                  </div>
                  {apiKeys.length ? (
                    <div className="divide-y divide-slate-100">
                      {apiKeys.map((apiKey) => (
                        <article
                          key={apiKey._id}
                          className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="break-all font-semibold text-slate-900">
                                {apiKey.name}
                              </h4>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                  apiKey.isActive
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {apiKey.isActive ? "Active" : "Disabled"}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              <span>
                                Created{" "}
                                {new Date(apiKey.createdAt).toLocaleDateString()}
                              </span>
                              {apiKey.expiresAt && (
                                <span>
                                  Expires{" "}
                                  {new Date(apiKey.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                              {apiKey.senderUserId && (
                                <span className="break-all">
                                  Bound sender: {apiKey.senderUserId}
                                </span>
                              )}
                              {isPlatformAdmin && (
                                <span>Owner: {apiKey.ownerUserId}</span>
                              )}
                              <span>{apiKey.sentCount} messages sent</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              onClick={() =>
                                handleToggleApiKeyActive(
                                  apiKey._id,
                                  apiKey.isActive,
                                )
                              }
                              disabled={saving === apiKey._id}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                            >
                              {saving === apiKey._id
                                ? "Updating..."
                                : apiKey.isActive
                                  ? "Disable"
                                  : "Enable"}
                            </button>
                            <button
                              onClick={() => handleDeleteApiKey(apiKey._id)}
                              disabled={saving === apiKey._id}
                              className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-12 text-center sm:px-6">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-500">
                        API
                      </div>
                      <h4 className="mt-4 font-semibold text-slate-900">
                        No API keys yet
                      </h4>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                        Create a key for your server integration. The secret is
                        displayed once when it is created.
                      </p>
                      <button
                        onClick={() => setShowCreateApiKey(true)}
                        className={`mt-5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${
                          isPlatformAdmin
                            ? "bg-indigo-700 hover:bg-indigo-800"
                            : "bg-emerald-700 hover:bg-emerald-800"
                        }`}
                      >
                        Create your first API key
                      </button>
                    </div>
                  )}
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
