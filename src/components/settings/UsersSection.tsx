'use client'

import { useState, useEffect } from 'react'
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  UserCog,
  Search,
  ChevronLeft,
  ChevronRight,
  Building2,
} from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import CreateUserModal from './CreateUserModal'
import AssignRoleModal from './AssignRoleModal'
import EditUserModal from './EditUserModal'
import UserDetailDrawer from './UserDetailDrawer'
import { type User, type Role } from '@/src/schema/settings/list'
import { setUserStatus } from '@/src/app/(app)/(dashboard)/settings/_actions/set-user-status'
import { adminResetUserPassword } from '@/src/libs/auth/actions/admin-reset-password'
import { showToast } from '@/src/components/ui/toast'

type OpenMenu = string | null

type Meta = { total: number; page: number; limit: number; totalPages?: number; lastPage?: number }
type Branch = { id: string; name: string }

type UsersSectionProps = {
  users: User[]
  meta?: Meta
  currentSearch?: string
  currentStatus?: string
  currentBranchId?: string
  branches?: Branch[]
  availableRoles?: Role[]
  currentUserId?: string
  canAddUser?: boolean
}

export default function UsersSection({
  users,
  meta,
  currentSearch = '',
  currentStatus = '',
  currentBranchId = '',
  branches = [],
  availableRoles = [],
  currentUserId,
  canAddUser = false,
}: UsersSectionProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [search, setSearch] = useState(currentSearch)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<User | null>(null)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [drawerUser, setDrawerUser] = useState<User | null>(null)

  // Sync local search state if the prop changes (e.g. browser back/forward)
  useEffect(() => {
    setSearch(currentSearch)
  }, [currentSearch])

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams()
    const merged: Record<string, string | number | undefined> = {
      ...(currentSearch && { search: currentSearch }),
      ...(currentStatus && { status: currentStatus }),
      ...(currentBranchId && { branchId: currentBranchId }),
      ...(meta?.page && meta.page > 1 && { page: meta.page }),
      ...overrides,
    }
    Object.entries(merged).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && String(v) !== '1') params.set(k, String(v))
    })
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  const buildFilterHref = (overrides: Record<string, string>) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (currentStatus) params.set('status', currentStatus)
    if (currentBranchId) params.set('branchId', currentBranchId)
    Object.entries(overrides).forEach(([k, v]) => {
      if (v) params.set(k, v)
      else params.delete(k)
    })
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  // Debounce search → update URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search === currentSearch) return
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (currentStatus) params.set('status', currentStatus)
      if (currentBranchId) params.set('branchId', currentBranchId)
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname)
    }, 400)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatusChange = (newStatus: string) => {
    router.replace(buildFilterHref({ status: newStatus, page: '' }))
  }

  const handleBranchChange = (newBranchId: string) => {
    router.replace(buildFilterHref({ branchId: newBranchId, page: '' }))
  }

  const totalPages = meta?.totalPages ?? meta?.lastPage ?? 1
  const currentPage = meta?.page ?? 1

  const handleSuccess = () => {
    // User created successfully - refresh the page to show new data
    router.refresh()
  }

  const handleToggleActive = async (user: User) => {
    setOpenMenu(null)
    setDrawerUser(null)
    const result = await setUserStatus(user.id, !user.isActive)
    if (result.success) {
      showToast({
        title: user.isActive ? 'User deactivated' : 'User activated',
        description: `${user.email} is now ${user.isActive ? 'inactive' : 'active'}.`,
        status: 'success',
      })
      router.refresh()
    } else {
      showToast({
        title: 'Failed to update status',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
    }
  }

  const handleDelete = (user: User) => {
    // TODO: Implement delete user API call
    console.log('Delete user:', user.id)
    setOpenMenu(null)
    setDrawerUser(null)
  }

  const handleResetPassword = async (user: User) => {
    setOpenMenu(null)
    const result = await adminResetUserPassword(user.id)
    if (result.success) {
      showToast({
        title: 'Reset email sent',
        description: `Password reset email sent to ${user.email}.`,
        status: 'success',
      })
    } else {
      showToast({
        title: 'Failed to send reset email',
        description: result.error ?? 'Please try again.',
        status: 'error',
      })
    }
  }

  const handleEdit = (user: User) => {
    setEditTarget(user)
    setOpenMenu(null)
    setDrawerUser(null)
  }

  const handleAssignRole = (user: User) => {
    setAssignTarget(user)
    setOpenMenu(null)
    setDrawerUser(null)
  }

  return (
    <>
      {/* Unified card: header + toolbar + table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h1 className="text-lg font-semibold text-zinc-900">Users</h1>
          {canAddUser && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              + Add User
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
          <div className="relative flex-1 min-w-50 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400"
            />
          </div>
          {branches.length > 0 && (
            <div className="relative">
              <Building2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <select
                value={currentBranchId}
                onChange={(e) => handleBranchChange(e.target.value)}
                className="rounded-lg border border-zinc-200 py-2 pl-8 pr-8 text-sm text-zinc-900 outline-none focus:border-zinc-400 appearance-none bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-1.5">
            {(['', 'ACTIVE', 'INACTIVE'] as const).map((s) => {
              const label = s === '' ? 'All' : s === 'ACTIVE' ? 'Active' : 'Inactive'
              const isActive = currentStatus === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatusChange(s)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    isActive
                      ? 'bg-prominent-purple-700 text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table */}
        <div className="border-t border-zinc-100">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-100 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Email</th>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-left font-medium">Roles</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Created</th>
                  <th className="px-4 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((user, index) => {
                    const isNearBottom = index >= users.length - 3
                    const displayName =
                      (user.name && user.name.trim()) ||
                      (user.firstName || user.lastName
                        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                        : null) ||
                      (user.employee
                        ? `${user.employee.firstName} ${user.employee.lastName}`.trim()
                        : null) ||
                      'N/A'
                    const userRoles = user.userRoles.map((ur) => ur.role.name)
                    const rolesDisplay = userRoles.length > 0 ? userRoles.join(', ') : 'No roles'
                    const createdDate = new Date(user.createdAt).toLocaleDateString()

                    const isSelf = currentUserId === user.id

                    return (
                      <tr
                        key={user.id}
                        className="border-t border-zinc-100 hover:bg-zinc-50 cursor-pointer"
                        onClick={() => setDrawerUser(user)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-900">{user.email}</span>
                            {isSelf && (
                              <span className="rounded-full bg-prominent-purple-100 px-2 py-0.5 text-xs font-medium text-prominent-purple-700">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{displayName}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-zinc-500" />
                            <span className="text-zinc-700">{rolesDisplay}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              user.isActive
                                ? 'bg-green-100 text-green-700'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">{createdDate}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {isSelf ? (
                            <span className="px-1.5 text-sm text-zinc-400">—</span>
                          ) : (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setOpenMenu(openMenu === user.id ? null : user.id)}
                                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                              {openMenu === user.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setOpenMenu(null)}
                                  />
                                  <div
                                    className={`absolute right-0 z-50 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-48 rounded-lg border border-zinc-200 bg-white py-1 shadow-lg`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(user)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAssignRole(user)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                    >
                                      <UserCog className="h-4 w-4" />
                                      Assign Role
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleActive(user)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-zinc-700 transition hover:bg-zinc-50"
                                    >
                                      <Pencil className="h-4 w-4" />
                                      {user.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(user)}
                                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {meta && (
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-sm text-zinc-500">
          <span>
            {meta.total === 0
              ? 'No users found'
              : `Showing ${(currentPage - 1) * meta.limit + 1}–${Math.min(currentPage * meta.limit, meta.total)} of ${meta.total} users`}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              {currentPage > 1 ? (
                <Link
                  href={buildHref({ page: currentPage - 1 })}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300">
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={buildHref({ page: currentPage + 1 })}
                  className="flex items-center gap-1 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 rounded-md border border-zinc-100 px-3 py-1.5 text-xs text-zinc-300">
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={handleSuccess}
        availableRoles={availableRoles}
      />

      {assignTarget && (
        <AssignRoleModal
          user={assignTarget}
          availableRoles={availableRoles}
          isOpen={true}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {editTarget && (
        <EditUserModal user={editTarget} isOpen={true} onClose={() => setEditTarget(null)} />
      )}

      <UserDetailDrawer
        user={drawerUser}
        onClose={() => setDrawerUser(null)}
        isSelf={drawerUser?.id === currentUserId}
        onEdit={handleEdit}
        onAssignRole={handleAssignRole}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
        onResetPassword={handleResetPassword}
      />
    </>
  )
}
