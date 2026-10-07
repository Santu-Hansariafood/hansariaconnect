"use client";

import { useState } from "react";

export interface AdminUserPermissions {
  contacts: boolean;
  groups: boolean;
  status: boolean;
  attachments: boolean;
}

export interface AdminDirectoryUser {
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
  permissions: AdminUserPermissions;
}

export interface AdminUserPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AdminUsersPanelProps {
  users: AdminDirectoryUser[];
  pagination: AdminUserPagination;
  refreshing: boolean;
  savingId: string | null;
  selectedUser: AdminDirectoryUser | null;
  setSelectedUser: (user: AdminDirectoryUser | null) => void;
  onRegisterAccounts: () => void;
  onPageChange: (page: number) => void;
  onSavePermissions: (id: string, permissions: AdminUserPermissions) => void;
}

export default function AdminUsersPanel({
  users,
  pagination,
  refreshing,
  savingId,
  selectedUser,
  setSelectedUser,
  onRegisterAccounts,
  onPageChange,
  onSavePermissions,
}: AdminUsersPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            Platform user directory
          </h2>
          <p className="text-sm text-gray-500">
            {pagination.total} total users across the platform, 100 per page
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onRegisterAccounts}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Register Accounts
          </button>
          <button
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page <= 1 || refreshing}
            className="rounded-lg border border-gray-200 px-3 py-2 text-gray-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages || refreshing}
            className="rounded-lg border border-gray-200 px-3 py-2 text-gray-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="grid grid-cols-12 gap-3 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-600">
          <div className="col-span-3">User</div>
          <div className="col-span-2 text-center">Contacts</div>
          <div className="col-span-2 text-center">Groups</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-2 text-center">Attachments</div>
          <div className="col-span-1 text-center">Save</div>
        </div>
        {users.map((user) => (
          <UserRow
            key={`${user.id}-${Number(user.permissions.contacts)}-${Number(user.permissions.groups)}-${Number(user.permissions.status)}-${Number(user.permissions.attachments)}`}
            user={user}
            onSave={(permissions) => onSavePermissions(user.id, permissions)}
            saving={savingId === user.id}
            onView={() => setSelectedUser(user)}
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
  );
}

function UserRow({
  user,
  onSave,
  saving,
  onView,
}: {
  user: AdminDirectoryUser;
  onSave: (permissions: AdminUserPermissions) => void;
  saving: boolean;
  onView: () => void;
}) {
  const [contacts, setContacts] = useState(user.permissions.contacts);
  const [groups, setGroups] = useState(user.permissions.groups);
  const [status, setStatus] = useState(user.permissions.status);
  const [attachments, setAttachments] = useState(user.permissions.attachments);

  return (
    <div className="grid grid-cols-12 items-center gap-3 border-t border-gray-100 px-4 py-3">
      <div className="col-span-3">
        <button
          onClick={onView}
          className="text-left font-medium text-emerald-700 hover:underline"
        >
          {user.name || user.mobile}
        </button>
        <div className="text-xs text-gray-500">{user.mobile}</div>
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          aria-label={`Contacts permission for ${user.name || user.mobile}`}
          type="checkbox"
          checked={contacts}
          onChange={(event) => setContacts(event.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          aria-label={`Groups permission for ${user.name || user.mobile}`}
          type="checkbox"
          checked={groups}
          onChange={(event) => setGroups(event.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          aria-label={`Status permission for ${user.name || user.mobile}`}
          type="checkbox"
          checked={status}
          onChange={(event) => setStatus(event.target.checked)}
        />
      </div>
      <div className="col-span-2 flex justify-center">
        <input
          aria-label={`Attachments permission for ${user.name || user.mobile}`}
          type="checkbox"
          checked={attachments}
          onChange={(event) => setAttachments(event.target.checked)}
        />
      </div>
      <div className="col-span-1 flex justify-center">
        <button
          onClick={() => onSave({ contacts, groups, status, attachments })}
          disabled={saving}
          className="rounded-lg bg-emerald-600 px-3 py-1 text-sm text-white hover:bg-emerald-700 disabled:opacity-60"
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
  user: AdminDirectoryUser;
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
