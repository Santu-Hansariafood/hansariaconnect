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

export default function AdminDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSuperSubdomain, setIsSuperSubdomain] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "admins">("users");

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
    // Check session from cookie
    const cookies = document.cookie;
    const adminSessionCookie = cookies.split("; ").find(c => c.startsWith("admin_session="));
    if (!adminSessionCookie) {
      router.replace("/admin/login");
      return;
    }
    try {
      const session = JSON.parse(decodeURIComponent(adminSessionCookie.split("=")[1]));
      setIsSuperAdmin(session.isSuperAdmin);
      
      // If on super subdomain, ensure user is a super admin
      if (isSuperSubdomain && !session.isSuperAdmin) {
        router.replace("/admin/login");
        return;
      }
    } catch {
      router.replace("/admin/login");
      return;
    }

    loadData();
  }, [router, isSuperSubdomain]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      // Load users
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

      // Load admins if super admin OR on super subdomain
      if (isSuperAdmin || isSuperSubdomain) {
        const adminsRes = await fetch("/api/admin/admins", { cache: "no-store" });
        const adminsData = await adminsRes.json();
        if (adminsRes.ok) {
          setAdmins(adminsData?.admins || []);
        }
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
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
            {(isSuperAdmin || isSuperSubdomain) && (
              <div className="flex mb-6 bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setActiveTab("users")}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "users" ? "bg-white shadow text-emerald-600" : "text-gray-500"
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => setActiveTab("admins")}
                  className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "admins" ? "bg-white shadow text-emerald-600" : "text-gray-500"
                  }`}
                >
                  Admins
                </button>
              </div>
            )}

            {/* Users Tab */}
            {(activeTab === "users" || !(isSuperAdmin || isSuperSubdomain)) && (
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
