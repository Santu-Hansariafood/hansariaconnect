"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [loading, setLoading] = useState(true);
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
  const [activeTab, setActiveTab] = useState<"users" | "admins" | "api-keys" | "accounts" | "templates" | "profile">("users");
  const [templates, setTemplates] = useState<{ _id: string; name: string; body: string }[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [adminProfile, setAdminProfile] = useState({ userId: "", email: "", isSuperAdmin: false });
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiresDays, setNewApiKeyExpiresDays] = useState("");
  const [newApiKeySenderUserId, setNewApiKeySenderUserId] = useState("");
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(null);

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
  const [bulkUsersText, setBulkUsersText] = useState("");

  useEffect(() => {
    const host = window.location.host;
    setIsSuperSubdomain(/^super\./i.test(host));
  }, []);

  useEffect(() => {
    const checkSession = async () => {
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
        if (!data.admin.isSuperAdmin && !isSuperSubdomain) setActiveTab("accounts");

        if (isSuperSubdomain && !data.admin.isSuperAdmin) {
          router.replace("/admin/login");
          return;
        }

        loadData(1, data.admin.isSuperAdmin || isSuperSubdomain);
      } catch {
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    const host = window.location.host;
    if (host) {
      setIsSuperSubdomain(/^super\./i.test(host));
    }
    checkSession();
  }, [router]);

  const loadData = async (
    userPage = userPagination.page,
    canManageUsers = isSuperAdmin || isSuperSubdomain,
  ) => {
    setLoading(true);
    setError("");
    try {
      if (canManageUsers) {
        const usersRes = await fetch(`/api/admin/users?page=${userPage}`, { cache: "no-store" });
        if (usersRes.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const usersData = await usersRes.json();
        if (!usersRes.ok) {
          setError(usersData?.error || "Failed to load users");
          return;
        }
        setUsers(usersData?.users || []);
        setUserPagination(usersData?.pagination || userPagination);
      }

      if (canManageUsers) {
        const adminsRes = await fetch("/api/admin/admins", { cache: "no-store" });
        const adminsData = await adminsRes.json();
        if (adminsRes.ok) {
          setAdmins(adminsData?.admins || []);
        }
      }

      const apiKeysRes = await fetch("/api/admin/api-keys", { cache: "no-store" });
      const apiKeysData = await apiKeysRes.json();
      if (apiKeysRes.ok) {
        setApiKeys(apiKeysData?.apiKeys || []);
      }

      const [templatesRes, profileRes] = await Promise.all([
        fetch("/api/admin/templates", { cache: "no-store" }),
        fetch("/api/admin/profile", { cache: "no-store" }),
      ]);
      if (templatesRes.ok) setTemplates((await templatesRes.json()).templates || []);
      if (profileRes.ok) {
        const profile = (await profileRes.json()).profile;
        setAdminProfile(profile);
        setProfileEmail(profile.email || "");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
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
    if (res.ok) setTemplates((previous) => previous.filter((template) => template._id !== id));
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving("profile");
    setError("");
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileEmail, password: profilePassword || undefined }),
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
          expiresDays: newApiKeyExpiresDays ? parseInt(newApiKeyExpiresDays) : undefined,
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
      loadData();
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
      const users = bulkUsersText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, email, mobile] = line.split(",").map((value) => value.trim());
          return { name, email, mobile };
        });
      if (!users.length) throw new Error("Add at least one account");
      if (users.some((user) => !user.name || !user.email || !user.mobile)) {
        throw new Error("Use one account per line: Name, email, mobile");
      }
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ users }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create accounts");
      setBulkUsersText("");
      setShowBulkUsers(false);
      loadData(1, true);
    } catch (error: any) {
      setError(error?.message || "Failed to create accounts");
    } finally {
      setSaving(null);
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
      loadData();
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
      loadData();
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
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, permissions: data.permissions } : u)));
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
      loadData();
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
      if (editAdminUserId !== editingAdmin.userId) updateData.userId = editAdminUserId;
      if (editAdminEmail !== editingAdmin.email) updateData.email = editAdminEmail;
      if (editAdminPassword) updateData.password = editAdminPassword;
      if (editAdminIsSuper !== editingAdmin.isSuperAdmin) updateData.isSuperAdmin = editAdminIsSuper;

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
      loadData();
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
      loadData();
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
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {isSuperSubdomain ? "Super Admin Dashboard" : "Admin Dashboard"}
          </h1>
          <button onClick={logout} className="px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700">
            Logout
          </button>
        </div>

        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
              {!isSuperAdmin && !isSuperSubdomain && (
                <>
                  <button onClick={() => setActiveTab("accounts")} className={`flex-1 py-2 rounded-lg font-semibold transition-all ${activeTab === "accounts" ? "bg-white shadow text-emerald-600" : "text-gray-500"}`}>Accounts</button>
                  <button onClick={() => setActiveTab("templates")} className={`flex-1 py-2 rounded-lg font-semibold transition-all ${activeTab === "templates" ? "bg-white shadow text-emerald-600" : "text-gray-500"}`}>Templates</button>
                  <button onClick={() => setActiveTab("profile")} className={`flex-1 py-2 rounded-lg font-semibold transition-all ${activeTab === "profile" ? "bg-white shadow text-emerald-600" : "text-gray-500"}`}>Profile</button>
                </>
              )}
              {(isSuperAdmin || isSuperSubdomain) && (
                <button
                  onClick={() => setActiveTab("users")}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "users" ? "bg-white shadow text-emerald-600" : "text-gray-500"
                  }`}
                >
                  Users
                </button>
              )}
              {(isSuperAdmin || isSuperSubdomain) && (
                <button
                  onClick={() => setActiveTab("admins")}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "admins" ? "bg-white shadow text-emerald-600" : "text-gray-500"
                  }`}
                >
                  Admins
                </button>
              )}
              <button
                onClick={() => setActiveTab("api-keys")}
                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                  activeTab === "api-keys" ? "bg-white shadow text-emerald-600" : "text-gray-500"
                }`}
              >
                API Keys
              </button>
            </div>

            {activeTab === "accounts" && !isSuperAdmin && !isSuperSubdomain && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800">Register chat accounts</h2>
                <p className="mt-1 text-sm text-gray-500">Use any valid business or personal email domain. Add one account per line.</p>
                <button onClick={() => setShowBulkUsers(true)} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700">Register Accounts</button>
                {showBulkUsers && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 sm:p-8">
                      <h3 className="text-xl font-bold">Register Multiple Accounts</h3>
                      <p className="mb-4 mt-2 text-sm text-gray-500">Format: Name, email, mobile</p>
                      <form onSubmit={handleCreateBulkUsers} className="space-y-4">
                        <textarea value={bulkUsersText} onChange={(event) => setBulkUsersText(event.target.value)} rows={9} placeholder={"Asha, asha@company.in, 9876543210\nRavi, ravi@business.com, 9123456780"} className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm" />
                        <div className="flex gap-3"><button type="button" onClick={() => setShowBulkUsers(false)} className="flex-1 rounded-xl bg-gray-200 px-4 py-3">Cancel</button><button type="submit" disabled={saving === "create-users"} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-white">{saving === "create-users" ? "Registering..." : "Register Accounts"}</button></div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "templates" && !isSuperAdmin && !isSuperSubdomain && (
              <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={createTemplate} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-800">Create message template</h2>
                  <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3" required />
                  <textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} placeholder="Hello {{name}}, your update is ready." rows={6} className="mt-3 w-full rounded-xl border border-gray-200 px-4 py-3" required />
                  <p className="mt-2 text-xs text-gray-500">Use variables like {"{{name}}"} and {"{{orderId}}"} for bulk messages.</p>
                  <button type="submit" disabled={saving === "template"} className="mt-4 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">{saving === "template" ? "Saving..." : "Save Template"}</button>
                </form>
                <div className="space-y-3">
                  {templates.map((template) => <div key={template._id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-gray-800">{template.name}</h3><button onClick={() => deleteTemplate(template._id)} className="text-sm text-red-600">Delete</button></div><p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{template.body}</p></div>)}
                  {!templates.length && <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500">No templates yet.</div>}
                </div>
              </div>
            )}

            {activeTab === "profile" && !isSuperAdmin && !isSuperSubdomain && (
              <form onSubmit={saveProfile} className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-800">Admin profile</h2>
                <p className="mt-1 text-sm text-gray-500">Signed in as {adminProfile.userId}</p>
                <label className="mt-5 block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={profileEmail} onChange={(event) => setProfileEmail(event.target.value)} className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3" required />
                <label className="mt-4 block text-sm font-medium text-gray-700">New password</label>
                <input type="password" value={profilePassword} onChange={(event) => setProfilePassword(event.target.value)} placeholder="Leave blank to keep current password" className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-3" />
                <button type="submit" disabled={saving === "profile"} className="mt-5 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white">{saving === "profile" ? "Saving..." : "Save Profile"}</button>
              </form>
            )}

            {/* Users Tab (Super Admin Only) */}
            {activeTab === "users" && (isSuperAdmin || isSuperSubdomain) && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">Users</h2>
                    <p className="text-sm text-gray-500">{userPagination.total} total users, 100 per page</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowBulkUsers(true)}
                      className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Register Accounts
                    </button>
                    <button
                      onClick={() => loadData(userPagination.page - 1)}
                      disabled={userPagination.page <= 1 || loading}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-gray-600">
                      Page {userPagination.page} of {userPagination.totalPages}
                    </span>
                    <button
                      onClick={() => loadData(userPagination.page + 1)}
                      disabled={userPagination.page >= userPagination.totalPages || loading}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
                {showBulkUsers && (
                  <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
                    <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
                      <h3 className="text-xl font-bold mb-2">Register Multiple Accounts</h3>
                      <p className="mb-4 text-sm text-gray-500">One account per line: Name, email, Indian mobile number</p>
                      <form onSubmit={handleCreateBulkUsers} className="space-y-4">
                        <textarea
                          value={bulkUsersText}
                          onChange={(event) => setBulkUsersText(event.target.value)}
                          rows={8}
                          placeholder={"Asha, asha@gmail.com, 9876543210\nRavi, ravi@outlook.com, 9123456780"}
                          className="w-full rounded-xl border border-gray-200 px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <div className="flex gap-3">
                          <button type="button" onClick={() => setShowBulkUsers(false)} className="flex-1 rounded-xl bg-gray-200 px-4 py-3 text-gray-700">Cancel</button>
                          <button type="submit" disabled={saving === "create-users"} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-white disabled:opacity-60">
                            {saving === "create-users" ? "Registering..." : "Register Accounts"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
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
                {users.length === 0 && <div className="px-4 py-8 text-center text-gray-500">No users found.</div>}
                </div>
                {selectedUser && <UserDetails user={selectedUser} onClose={() => setSelectedUser(null)} />}
              </div>
            )}

            {activeTab === "admins" && (isSuperAdmin || isSuperSubdomain) && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-800">Manage Admins</h2>
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
                      <h3 className="text-xl font-bold mb-4">Create New Admin</h3>
                      <form onSubmit={handleCreateAdmin} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Sender account ID</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newApiKeySenderUserId}
                            onChange={(e) => setNewApiKeySenderUserId(e.target.value)}
                            placeholder="Provisioned user ObjectId"
                            required
                          />
                          <p className="mt-1 text-xs text-gray-500">Bulk messages are sent from this account.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminUserId}
                            onChange={(e) => setNewAdminUserId(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                          <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                          <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            required
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="new-super"
                            checked={newAdminIsSuper}
                            onChange={(e) => setNewAdminIsSuper(e.target.checked)}
                          />
                          <label htmlFor="new-super" className="text-sm text-gray-700">
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                          <input
                            type="text"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={editAdminUserId}
                            onChange={(e) => setEditAdminUserId(e.target.value)}
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
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
                            onChange={(e) => setEditAdminPassword(e.target.value)}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="edit-super"
                            checked={editAdminIsSuper}
                            onChange={(e) => setEditAdminIsSuper(e.target.checked)}
                          />
                          <label htmlFor="edit-super" className="text-sm text-gray-700">
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
                            {saving === editingAdmin._id ? "Updating..." : "Update"}
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
                    <div key={admin._id} className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center">
                      <div className="col-span-3 font-medium text-gray-900">{admin.userId}</div>
                      <div className="col-span-4 text-gray-600">{admin.email}</div>
                      <div className="col-span-2 flex justify-center">
                        {admin.isSuperAdmin ? (
                          <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-semibold">Yes</span>
                        ) : (
                          <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-semibold">No</span>
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
                  <h2 className="text-lg font-semibold text-gray-800">Manage API Keys</h2>
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
                      <h3 className="text-xl font-bold mb-4">API Key Created</h3>
                      <div className="p-4 bg-gray-100 rounded-xl mb-4">
                        <p className="text-sm font-medium text-gray-800 mb-2">Save this key, you won't see it again:</p>
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
                      <h3 className="text-xl font-bold mb-4">Create New API Key</h3>
                      <form onSubmit={handleCreateApiKey} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Key Name</label>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">Expires (days, optional)</label>
                          <input
                            type="number"
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={newApiKeyExpiresDays}
                            onChange={(e) => setNewApiKeyExpiresDays(e.target.value)}
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
                            {saving === "create-api-key" ? "Creating..." : "Create"}
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
                    <div key={apiKey._id} className="grid grid-cols-12 gap-3 px-4 py-3 border-t border-gray-100 items-center">
                      <div className="col-span-4 font-medium text-gray-900">{apiKey.name}</div>
                      <div className="col-span-3 flex justify-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          apiKey.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                        }`}>
                          {apiKey.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="col-span-3 flex justify-center text-sm text-gray-500">
                        {new Date(apiKey.createdAt).toLocaleDateString()}
                      </div>
                      <div className="col-span-2 flex justify-center gap-2">
                        <button
                          onClick={() => handleToggleApiKeyActive(apiKey._id, apiKey.isActive)}
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
      </div>
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
        <button onClick={onView} className="font-medium text-emerald-700 hover:underline text-left">
          {user.name || user.mobile}
        </button>
        <div className="text-xs text-gray-500">{user.mobile}</div>
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={contacts} onChange={(e) => setContacts(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={groups} onChange={(e) => setGroups(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)} />
      </div>
      <div className="col-span-2 flex justify-center">
        <input type="checkbox" checked={attachments} onChange={(e) => setAttachments(e.target.checked)} />
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

function UserDetails({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const formatDate = (value: string | null) => value ? new Date(value).toLocaleString() : "Not available";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
      <div className="mx-auto min-h-full w-full max-w-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-8">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">User details</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-900" aria-label="Close user details">Close</button>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <Detail label="Name" value={user.name || "Not available"} />
          <Detail label="Mobile" value={user.mobile} />
          <Detail label="Email" value={user.email || "Not available"} />
          <Detail label="Gender" value={user.sex || "Not available"} />
          <Detail label="Date of birth" value={formatDate(user.dateOfBirth)} />
          <Detail label="Terms accepted" value={user.termsAccepted ? "Yes" : "No"} />
          <Detail label="Created" value={formatDate(user.createdAt)} />
          <Detail label="Last login" value={formatDate(user.lastLoginAt)} />
          <Detail label="Last login IP" value={user.lastLoginIp || "Not available"} />
          <Detail label="About" value={user.about || "Not available"} />
        </div>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-gray-700">Close</button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div><div className="break-words text-gray-900">{value}</div></div>;
}
