"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readSheet } from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

type BulkUserInput = {
  name: string;
  email: string;
  mobile: string;
};

const ACCOUNT_TEMPLATE_HEADERS = ["Name", "Email", "Mobile"] as const;

type Permission = {
  contacts: boolean;
  groups: boolean;
  status: boolean;
  attachments: boolean;
};

type UserRow = {
  id: string;
  mobile: string;
  name: string;
  email: string;
  sex: string;
  dateOfBirth: string | null;
  termsAccepted: boolean;
  lastLoginIp: string;
  lastLoginAt: string | null;
  createdAt: string | null;
  about: string;
  avatar: string;
  permissions: Permission;
};

type UserPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AdminRow = {
  _id: string;
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  createdAt: string;
};

type ApiKeyRow = {
  _id: string;
  name: string;
  permissions: any;
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
  const [activeTab, setActiveTab] = useState<
    "users" | "admins" | "api-keys" | "accounts" | "templates" | "profile"
  >("users");
  const [templates, setTemplates] = useState<
    { _id: string; name: string; body: string }[]
  >([]);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [adminProfile, setAdminProfile] = useState({
    userId: "",
    email: "",
    isSuperAdmin: false,
  });
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiresDays, setNewApiKeyExpiresDays] = useState("");
  const [newApiKeySenderUserId, setNewApiKeySenderUserId] = useState("");
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(
    null,
  );

  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [newAdminUserId, setNewAdminUserId] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminIsSuper, setNewAdminIsSuper] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminRow | null>(null);
  const [editAdminUserId, setEditAdminUserId] = useState("");
  const [editAdminEmail, setEditAdminEmail] = useState("");
  const [editAdminPassword, setEditAdminPassword] = useState("");
  const [editAdminIsSuper, setEditAdminIsSuper] = useState(false);
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

  const createTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving("template");
    setError("");
    try {
      const res = await fetch("/api/admin/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, body: templateBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create template");
      setTemplates((previous) => [data.template, ...previous]);
      setTemplateName("");
      setTemplateBody("");
    } catch (error: any) {
      setError(error?.message || "Failed to create template");
    } finally {
      setSaving(null);
    }
  };

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
    if (res.ok)
      setTemplates((previous) =>
        previous.filter((template) => template._id !== id),
      );
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
    setError("");
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
        setError(data.error || "Failed to create admin");
        return;
      }
      setShowCreateAdmin(false);
      setNewAdminUserId("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      setNewAdminIsSuper(false);
      void refreshData();
    } catch {
      setError("Network error");
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
      const updateData: any = {};
      if (editAdminUserId !== editingAdmin.userId)
        updateData.userId = editAdminUserId;
      if (editAdminEmail !== editingAdmin.email)
        updateData.email = editAdminEmail;
      if (editAdminPassword) updateData.password = editAdminPassword;
      if (editAdminIsSuper !== editingAdmin.isSuperAdmin)
        updateData.isSuperAdmin = editAdminIsSuper;

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
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black tracking-wide text-white shadow-md shadow-emerald-900/20">
              HC
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-bold text-slate-900 sm:text-lg">
                  {isSuperSubdomain
                    ? "Super Admin"
                    : isSuperAdmin
                      ? "Administrator"
                      : "Admin workspace"}
                </h1>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 ring-1 ring-emerald-700/10">
                  {isSuperSubdomain || isSuperAdmin ? "Super admin" : "Admin"}
                </span>
              </div>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {adminProfile.email ||
                  adminProfile.userId ||
                  "HansariaConnect control center"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              className={`hidden items-center gap-2 text-xs text-slate-500 transition-opacity sm:flex ${
                refreshing ? "opacity-100" : "opacity-0"
              }`}
              role="status"
              aria-live="polite"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              Updating
            </span>
            <button
              onClick={logout}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2 sm:px-4"
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

            {/* Tabs */}
            <nav
              aria-label="Admin sections"
              className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm"
            >
              {!isSuperAdmin && !isSuperSubdomain && (
                <>
                  <button
                    onClick={() => setActiveTab("accounts")}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "accounts" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    Accounts
                  </button>
                  <button
                    onClick={() => setActiveTab("templates")}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "templates" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    Templates
                  </button>
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${activeTab === "profile" ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    Profile
                  </button>
                </>
              )}
              {(isSuperAdmin || isSuperSubdomain) && (
                <button
                  onClick={() => setActiveTab("users")}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === "users"
                      ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Users
                </button>
              )}
              {(isSuperAdmin || isSuperSubdomain) && (
                <button
                  onClick={() => setActiveTab("admins")}
                  className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    activeTab === "admins"
                      ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Admins
                </button>
              )}
              <button
                onClick={() => setActiveTab("api-keys")}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  activeTab === "api-keys"
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/15"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                API Keys
              </button>
            </nav>

            {showBulkUsers && (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                  <h3 className="text-xl font-bold">
                    Register Multiple Accounts
                  </h3>
                  <p className="mb-5 mt-2 text-sm text-gray-500">
                    Download the admin Excel template, fill in one account per
                    row, then upload it. Keep the columns in the same order:
                    Name, Email, Mobile. You can register up to 100 accounts at
                    once.
                  </p>
                  {error && (
                    <div
                      role="alert"
                      className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                    >
                      {error}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleDownloadAccountTemplate}
                    className="rounded-xl border border-emerald-700 px-4 py-3 font-semibold text-emerald-800 hover:bg-emerald-50"
                  >
                    Download Excel Template
                  </button>
                  <form
                    onSubmit={handleCreateBulkUsers}
                    className="mt-6 space-y-4"
                  >
                    <label
                      className="block text-sm font-medium text-gray-700"
                      htmlFor="account-excel-file"
                    >
                      Excel file (.xlsx)
                    </label>
                    <input
                      ref={bulkUsersFileInput}
                      id="account-excel-file"
                      type="file"
                      accept=".xlsx"
                      onChange={handleAccountSheetUpload}
                      className="block w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                    />
                    {bulkUsersFileName && (
                      <p className="text-sm text-gray-600" role="status">
                        {bulkUsersFileName}: {bulkUsers.length} account
                        {bulkUsers.length === 1 ? "" : "s"} ready to register.
                      </p>
                    )}
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBulkUsers(false);
                          setBulkUsers([]);
                          setBulkUsersFileName("");
                          if (bulkUsersFileInput.current)
                            bulkUsersFileInput.current.value = "";
                        }}
                        className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          saving === "create-users" || !bulkUsers.length
                        }
                        className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-white disabled:opacity-60"
                      >
                        {saving === "create-users"
                          ? "Registering..."
                          : "Register Accounts"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "accounts" && !isSuperAdmin && !isSuperSubdomain && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800">
                  Register chat accounts
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Register multiple chat accounts with the admin Excel template.
                </p>
                <button
                  onClick={() => {
                    setError("");
                    setShowBulkUsers(true);
                  }}
                  className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  Register Accounts
                </button>
              </div>
            )}

            {activeTab === "templates" &&
              !isSuperAdmin &&
              !isSuperSubdomain && (
                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <form
                    onSubmit={createTemplate}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
                  >
                    <h2 className="text-lg font-semibold text-gray-800">
                      Create message template
                    </h2>
                    <input
                      value={templateName}
                      onChange={(event) => setTemplateName(event.target.value)}
                      placeholder="Template name"
                      className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3"
                      required
                    />
                    <textarea
                      value={templateBody}
                      onChange={(event) => setTemplateBody(event.target.value)}
                      placeholder="Hello {{name}}, your update is ready."
                      rows={6}
                      className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3"
                      required
                    />
                    <p className="mt-2 text-xs text-gray-500">
                      Use variables like {"{{name}}"} and {"{{orderId}}"} for
                      bulk messages. Each template can be sent using an API
                      key with permission to send messages.
                    </p>
                    <button
                      type="submit"
                      disabled={saving === "template"}
                      className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white"
                    >
                      {saving === "template" ? "Saving..." : "Save Template"}
                    </button>
                  </form>
                  <div className="space-y-3">
                    {templates.map((template) => (
                      <div
                        key={template._id}
                        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-semibold text-gray-800">
                            {template.name}
                          </h3>
                          <button
                            onClick={() => deleteTemplate(template._id)}
                            className="text-sm text-red-600"
                          >
                            Delete
                          </button>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">
                          {template.body}
                        </p>
                        <p className="mt-3 break-all text-xs text-gray-500">
                          Template ID: <code>{template._id}</code>
                        </p>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm font-medium text-emerald-700">
                            API integration example
                          </summary>
                          <div className="mt-3 rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                            <p className="mb-2">
                              Send an in-app message to a HansariaConnect user
                              with an Authorization Bearer API key:
                            </p>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words">
                              {`await fetch("https://YOUR_DOMAIN/api/v1/messages/bulk", {
  method: "POST",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
  "templateId": "${template._id}",
  "recipients": [{
    "toUserId": "RECIPIENT_USER_ID",
    "variables": { "name": "Asha", "otp": "123456", "orderId": "ORD-1001" },
    "attachment": {
      "type": "pdf",
      "mediaUrl": "https://files.example.com/orders/ORD-1001.pdf",
      "fileName": "ORD-1001.pdf"
    }
  }]
  })
});`}
                            </pre>
                            <p className="mt-3 text-slate-300">
                              The attachment is optional and can be supplied
                              separately for each recipient. Use image, pdf,
                              video, excel, or file as its type and provide an
                              HTTPS URL.
                            </p>
                          </div>
                        </details>
                      </div>
                    ))}
                    {!templates.length && (
                      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">
                        No templates yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

            {activeTab === "profile" && !isSuperAdmin && !isSuperSubdomain && (
              <form
                onSubmit={saveProfile}
                className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-gray-800">
                  Admin profile
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Signed in as {adminProfile.userId}
                </p>
                <label className="mt-5 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(event) => setProfileEmail(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                  required
                />
                <label className="mt-4 block text-sm font-medium text-gray-700">
                  New password
                </label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                  placeholder="Leave blank to keep current password"
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3"
                />
                <button
                  type="submit"
                  disabled={saving === "profile"}
                  className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white"
                >
                  {saving === "profile" ? "Saving..." : "Save Profile"}
                </button>
              </form>
            )}

            {/* Users Tab (Super Admin Only) */}
            {activeTab === "users" && (isSuperAdmin || isSuperSubdomain) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">
                      Users
                    </h2>
                    <p className="text-sm text-gray-500">
                      {userPagination.total} total users, 100 per page
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setError("");
                        setShowBulkUsers(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Register Accounts
                    </button>
                    <button
                      onClick={() => void refreshData(userPagination.page - 1)}
                      disabled={userPagination.page <= 1 || refreshing}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {userPagination.page} of {userPagination.totalPages}
                    </span>
                    <button
                      onClick={() => void refreshData(userPagination.page + 1)}
                      disabled={
                        userPagination.page >= userPagination.totalPages ||
                        refreshing
                      }
                      className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50">
                    <div className="col-span-3">User</div>
                    <div className="col-span-2 text-center">Contacts</div>
                    <div className="col-span-2 text-center">Groups</div>
                    <div className="col-span-2 text-center">Status</div>
                    <div className="col-span-2 text-center">Attachments</div>
                    <div className="col-span-1 text-center">Save</div>
                  </div>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onSave={(p) => updateUserPermissions(u.id, p)}
                      saving={saving === u.id}
                      onView={() => setSelectedUser(u)}
                    />
                  ))}
                  {users.length === 0 && (
                    <div className="px-4 py-8 text-center text-gray-500">
                      No users found.
                    </div>
                  )}
                </div>
                {selectedUser && (
                  <UserDetails
                    user={selectedUser}
                    onClose={() => setSelectedUser(null)}
                  />
                )}
              </div>
            )}

            {activeTab === "admins" && (isSuperAdmin || isSuperSubdomain) && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Manage Admins
                  </h2>
                  <button
                    onClick={() => setShowCreateAdmin(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Create Admin
                  </button>
                </div>

                {showCreateAdmin && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                      <h3 className="text-xl font-bold mb-4">
                        Create New Admin
                      </h3>
                      <form onSubmit={handleCreateAdmin} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sender account ID
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newApiKeySenderUserId}
                            onChange={(e) =>
                              setNewApiKeySenderUserId(e.target.value)
                            }
                            placeholder="Provisioned user ObjectId"
                            required
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Bulk messages are sent from this account.
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            User ID
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminUserId}
                            onChange={(e) => setNewAdminUserId(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password
                          </label>
                          <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminPassword}
                            onChange={(e) =>
                              setNewAdminPassword(e.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="new-super"
                            checked={newAdminIsSuper}
                            onChange={(e) =>
                              setNewAdminIsSuper(e.target.checked)
                            }
                          />
                          <label
                            htmlFor="new-super"
                            className="text-sm text-gray-700"
                          >
                            Is Super Admin
                          </label>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowCreateAdmin(false)}
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving === "create"}
                            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {saving === "create" ? "Creating..." : "Create"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {editingAdmin && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                      <h3 className="text-xl font-bold mb-4">Edit Admin</h3>
                      <form onSubmit={handleUpdateAdmin} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            User ID
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editAdminUserId}
                            onChange={(e) => setEditAdminUserId(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editAdminEmail}
                            onChange={(e) => setEditAdminEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            New Password (leave blank to keep current)
                          </label>
                          <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editAdminPassword}
                            onChange={(e) =>
                              setEditAdminPassword(e.target.value)
                            }
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="edit-super"
                            checked={editAdminIsSuper}
                            onChange={(e) =>
                              setEditAdminIsSuper(e.target.checked)
                            }
                          />
                          <label
                            htmlFor="edit-super"
                            className="text-sm text-gray-700"
                          >
                            Is Super Admin
                          </label>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setEditingAdmin(null)}
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving === editingAdmin._id}
                            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            {saving === editingAdmin._id
                              ? "Updating..."
                              : "Update"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50">
                    <div className="col-span-3">User ID</div>
                    <div className="col-span-4">Email</div>
                    <div className="col-span-2 text-center">Super Admin</div>
                    <div className="col-span-3 text-center">Actions</div>
                  </div>
                  {admins.map((admin) => (
                    <div
                      key={admin._id}
                      className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center"
                    >
                      <div className="col-span-3 font-medium text-gray-900">
                        {admin.userId}
                      </div>
                      <div className="col-span-4 text-gray-600">
                        {admin.email}
                      </div>
                      <div className="col-span-2 flex justify-center">
                        {admin.isSuperAdmin ? (
                          <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">
                            Yes
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-semibold">
                            No
                          </span>
                        )}
                      </div>
                      <div className="col-span-3 flex justify-center gap-2">
                        <button
                          onClick={() => {
                            setEditingAdmin(admin);
                            setEditAdminUserId(admin.userId);
                            setEditAdminEmail(admin.email);
                            setEditAdminPassword("");
                            setEditAdminIsSuper(admin.isSuperAdmin);
                          }}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteAdmin(admin._id)}
                          disabled={saving === admin._id}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                        >
                          {saving === admin._id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "api-keys" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Manage API Keys
                  </h2>
                  <button
                    onClick={() => setShowCreateApiKey(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Create API Key
                  </button>
                </div>

                {newlyCreatedApiKey && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                      <h3 className="text-xl font-bold mb-4">
                        API Key Created
                      </h3>
                      <div className="p-4 bg-gray-100 rounded-xl mb-4">
                        <p className="text-sm font-medium text-gray-800 mb-2">
                          Save this key, you won't see it again:
                        </p>
                        <div className="font-mono text-sm break-all bg-white p-3 rounded border border-gray-200">
                          {newlyCreatedApiKey}
                        </div>
                      </div>
                      <button
                        onClick={() => setNewlyCreatedApiKey(null)}
                        className="w-full py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold"
                      >
                        Got it
                      </button>
                    </div>
                  </div>
                )}

                {showCreateApiKey && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                      <h3 className="text-xl font-bold mb-4">
                        Create New API Key
                      </h3>
                      <form onSubmit={handleCreateApiKey} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Key Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newApiKeyName}
                            onChange={(e) => setNewApiKeyName(e.target.value)}
                            placeholder="My Integration"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Expires (days, optional)
                          </label>
                          <input
                            type="number"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newApiKeyExpiresDays}
                            onChange={(e) =>
                              setNewApiKeyExpiresDays(e.target.value)
                            }
                            placeholder="30"
                            min="1"
                          />
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowCreateApiKey(false)}
                            className="flex-1 px-4 py-3 rounded-xl bg-gray-200 text-gray-700 hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={saving === "create-api-key"}
                            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {saving === "create-api-key"
                              ? "Creating..."
                              : "Create"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="grid grid-cols-12 gap-3 px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50">
                    <div className="col-span-4">Name</div>
                    <div className="col-span-3 text-center">Status</div>
                    <div className="col-span-3 text-center">Created At</div>
                    <div className="col-span-2 text-center">Actions</div>
                  </div>
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey._id}
                      className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center"
                    >
                      <div className="col-span-4 font-medium text-gray-900">
                        {apiKey.name}
                      </div>
                      <div className="col-span-3 flex justify-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            apiKey.isActive
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {apiKey.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="col-span-3 flex justify-center text-sm text-gray-500">
                        {new Date(apiKey.createdAt).toLocaleDateString()}
                      </div>
                      <div className="col-span-2 flex justify-center gap-2">
                        <button
                          onClick={() =>
                            handleToggleApiKeyActive(
                              apiKey._id,
                              apiKey.isActive,
                            )
                          }
                          disabled={saving === apiKey._id}
                          className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                        >
                          {apiKey.isActive ? "Disable" : "Enable"}
                        </button>
                        <button
                          onClick={() => handleDeleteApiKey(apiKey._id)}
                          disabled={saving === apiKey._id}
                          className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm hover:bg-red-700 disabled:opacity-60"
                        >
                          {saving === apiKey._id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function UserRow({
  user,
  onSave,
  saving,
  onView,
}: {
  user: UserRow;
  onSave: (p: Permission) => void;
  saving: boolean;
  onView: () => void;
}) {
  const [contacts, setContacts] = useState(user.permissions.contacts);
  const [groups, setGroups] = useState(user.permissions.groups);
  const [status, setStatus] = useState(user.permissions.status);
  const [attachments, setAttachments] = useState(user.permissions.attachments);
  useEffect(() => {
    setContacts(user.permissions.contacts);
    setGroups(user.permissions.groups);
    setStatus(user.permissions.status);
    setAttachments(user.permissions.attachments);
  }, [user.permissions]);
  return (
    <div className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center">
      <div className="col-span-3">
        <button
          onClick={onView}
          className="font-medium text-emerald-700 hover:underline text-left"
        >
          {user.name || user.mobile}
        </button>
        <div className="text-xs text-gray-500">{user.mobile}</div>
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          type="checkbox"
          checked={contacts}
          onChange={(e) => setContacts(e.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          type="checkbox"
          checked={groups}
          onChange={(e) => setGroups(e.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          type="checkbox"
          checked={status}
          onChange={(e) => setStatus(e.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          type="checkbox"
          checked={attachments}
          onChange={(e) => setAttachments(e.target.checked)}
        />
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          onClick={() => onSave({ contacts, groups, status, attachments })}
          disabled={saving}
          className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-60"
        >
          {saving ? "..." : "Save"}
        </button>
      </div>
    </div>
  );
}

function UserDetails({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleString() : "Not available";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">User details</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900"
            aria-label="Close user details"
          >
            Close
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail label="Name" value={user.name || "Not available"} />
          <Detail label="Mobile" value={user.mobile} />
          <Detail label="Email" value={user.email || "Not available"} />
          <Detail label="Gender" value={user.sex || "Not available"} />
          <Detail label="Date of birth" value={formatDate(user.dateOfBirth)} />
          <Detail
            label="Terms accepted"
            value={user.termsAccepted ? "Yes" : "No"}
          />
          <Detail label="Created" value={formatDate(user.createdAt)} />
          <Detail label="Last login" value={formatDate(user.lastLoginAt)} />
          <Detail
            label="Last login IP"
            value={user.lastLoginIp || "Not available"}
          />
          <Detail label="About" value={user.about || "Not available"} />
        </div>
        <button
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="break-words text-gray-900">{value}</div>
    </div>
  );
}
