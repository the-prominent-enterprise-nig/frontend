'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { UserPlus, X, KeyRound, UserX, Copy, Check } from 'lucide-react'

interface UserRole {
  role: { name: string }
}

interface Admin {
  id: string
  email: string
  name?: string | null
  firstName?: string | null
  lastName?: string | null
  isActive: boolean
  status: string
  createdAt: string
  lastLoginAt?: string | null
  userRoles: UserRole[]
}

interface Props {
  enterpriseId: string
  admins: Admin[]
}

const ROLES = [
  { value: 'Business Owner', label: 'Business Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'hr-admin', label: 'HR Admin' },
]

function displayName(admin: Admin) {
  if (admin.name) return admin.name
  if (admin.firstName || admin.lastName)
    return [admin.firstName, admin.lastName].filter(Boolean).join(' ')
  return admin.email
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export function AdminsClient({ enterpriseId, admins: initial }: Props) {
  const router = useRouter()
  const [admins, setAdmins] = useState<Admin[]>(initial)
  const [showAdd, setShowAdd] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Add admin form state
  const [addForm, setAddForm] = useState({ name: '', email: '', role: 'admin' })
  const [addLoading, setAddLoading] = useState(false)

  // Password reset token modal
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function addAdmin() {
    if (!addForm.name.trim() || !addForm.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setAddLoading(true)
    try {
      const res = await fetch(`/api/super-admin/enterprises/${enterpriseId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to add admin')
      }
      toast.success('Admin added')
      setShowAdd(false)
      setAddForm({ name: '', email: '', role: 'admin' })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setAddLoading(false)
    }
  }

  async function deactivate(userId: string) {
    setActionLoading(userId + ':deactivate')
    try {
      const res = await fetch(
        `/api/super-admin/enterprises/${enterpriseId}/admins/${userId}/deactivate`,
        { method: 'PATCH' }
      )
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to deactivate')
      }
      toast.success('Admin deactivated')
      setAdmins((prev) =>
        prev.map((a) => (a.id === userId ? { ...a, isActive: false, status: 'inactive' } : a))
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  async function resetPassword(userId: string) {
    setActionLoading(userId + ':reset')
    try {
      const res = await fetch(
        `/api/super-admin/enterprises/${enterpriseId}/admins/${userId}/reset-password`,
        { method: 'POST' }
      )
      if (!res.ok) {
        const data = (await res.json()) as { message?: string }
        throw new Error(data.message ?? 'Failed to reset password')
      }
      const data = (await res.json()) as { token?: string; resetToken?: string }
      const token = data.token ?? data.resetToken ?? ''
      setResetToken(token)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setActionLoading(null)
    }
  }

  async function copyToken() {
    if (!resetToken) return
    await navigator.clipboard.writeText(resetToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Tenant Admins</h1>
          <p className="text-sm text-zinc-500">Manage who has access to this business.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" />
          Add Admin
        </button>
      </div>

      {/* Table */}
      {admins.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-400">No admins yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-100 dark:border-zinc-800">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-zinc-400">
                <th className="px-4 py-3">Name / Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {admins.map((admin) => {
                const roles = admin.userRoles.map((ur) => ur.role.name)
                const isDeactivating = actionLoading === admin.id + ':deactivate'
                const isResetting = actionLoading === admin.id + ':reset'

                return (
                  <tr key={admin.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        {displayName(admin)}
                      </p>
                      <p className="text-xs text-zinc-400">{admin.email}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {roles.length > 0 ? roles.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          admin.isActive
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {admin.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatRelative(admin.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-400">
                      {formatDate(admin.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {admin.isActive && (
                          <button
                            onClick={() => deactivate(admin.id)}
                            disabled={isDeactivating}
                            className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                          >
                            <UserX className="h-3 w-3" />
                            {isDeactivating ? 'Deactivating…' : 'Deactivate'}
                          </button>
                        )}
                        <button
                          onClick={() => resetPassword(admin.id)}
                          disabled={isResetting}
                          className="flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-600 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400"
                        >
                          <KeyRound className="h-3 w-3" />
                          {isResetting ? 'Resetting…' : 'Reset Password'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Admin Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Add Admin</h2>
              <button
                onClick={() => setShowAdd(false)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={addForm.name}
                  onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="Juan dela Cruz"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  placeholder="admin@business.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Role</label>
                <select
                  value={addForm.role}
                  onChange={(e) => setAddForm((p) => ({ ...p, role: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAdd(false)}
                disabled={addLoading}
                className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={addAdmin}
                disabled={addLoading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {addLoading ? 'Adding…' : 'Add Admin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Token Modal */}
      {resetToken !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Password Reset Token
              </h2>
              <button
                onClick={() => setResetToken(null)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-3 text-sm text-zinc-500">
              Share this token with the admin. It can only be used once.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800">
              <code className="flex-1 overflow-auto text-xs text-zinc-700 dark:text-zinc-300">
                {resetToken}
              </code>
              <button
                onClick={copyToken}
                className="rounded p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setResetToken(null)}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
