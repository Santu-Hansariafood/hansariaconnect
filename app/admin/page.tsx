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
  avatar: string;
  permissions: Permission;
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
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSuperSubdomain, setIsSuperSubdomain] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "admins" | "api-keys">("users");
  const [showCreateApiKey, setShowCreateApiKey] = useState(false);
  const [newApiKeyName, setNewApiKeyName] = useState("");
  const [newApiKeyExpiresDays, setNewApiKeyExpiresDays] = useState("");
  const [newlyCreatedApiKey, setNewlyCreatedApiKey] = useState<string | null>(null);

  // Admin management states
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

  useEffect(() => {
    // Check if on super subdomain
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

        // If on super subdomain, ensure user is a super admin
        if (isSuperSubdomain && !data.admin.isSuperAdmin) {
          router.replace("/admin/login");
          return;
        }

        loadData();
      } catch {
        router.replace("/admin/login");
      } finally {
        setLoading(false);
      }
    };

    // Only run checkSession once isSuperSubdomain is known
    // We'll use a short timeout or check if host is available immediately
    const host = window.location.host;
    if (host) {
      setIsSuperSubdomain(/^super\./i.test(host));
    }
    checkSession();
  }, [router]); // Removed isSuperSubdomain to prevent multiple calls

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Load users only if super admin OR on super subdomain
      if (isSuperAdmin || isSuperSubdomain) {
        const usersRes = await fetch("/api/admin/users", { cache: "no-store" });
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
      }

      // Load admins if super admin OR on super subdomain
      if (isSuperAdmin || isSuperSubdomain) {
        const adminsRes = await fetch("/api/admin/admins", { cache: "no-store" });
        const adminsData = await adminsRes.json();
        if (adminsRes.ok) {
          setAdmins(adminsData?.admins || []);
        }
      }

      // Load API keys
      const apiKeysRes = await fetch("/api/admin/api-keys", { cache: "no-store" });
      const apiKeysData = await apiKeysRes.json();
      if (apiKeysRes.ok) {
        setApiKeys(apiKeysData?.apiKeys || []);
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
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
      loadData();
    } catch {
      setError("Network error");
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

            {/* Users Tab (Super Admin Only) */}
            {activeTab === "users" && (isSuperAdmin || isSuperSubdomain) && (
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
                  />
                ))}
              </div>
            )}

            {/* Admins Tab (Super Admin Only or super. Subdomain) */}
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

                {/* Create Admin Modal */}
                {showCreateAdmin && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
                      <h3 className="text-xl font-bold mb-4">Create New Admin</h3>
                      <form onSubmit={handleCreateAdmin} className="space-y-4">
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

                {/* Edit Admin Modal */}
                {editingAdmin && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
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

                {/* Admins List */}
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

            {/* API Keys Tab */}
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

                {/* New API Key Created Modal */}
                {newlyCreatedApiKey && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
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

                {/* Create API Key Modal */}
                {showCreateApiKey && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-md">
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

                {/* API Keys List */}
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
}: {
  user: UserRow;
  onSave: (p: Permission) => void;
  saving: boolean;
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
        <div className="font-medium text-gray-900">{user.name || user.mobile}</div>
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
