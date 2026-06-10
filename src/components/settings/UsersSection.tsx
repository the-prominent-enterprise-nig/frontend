'use client'

import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, Shield, UserCog } from 'lucide-react'
import { useRouter } from 'next/navigation'
import CreateUserModal from './CreateUserModal'
import AssignRoleModal from './AssignRoleModal'
import UserDetailDrawer from './UserDetailDrawer'
import { type User, type Role } from '@/src/schema/settings/list'
import { setUserStatus } from '@/src/app/(app)/(dashboard)/settings/_actions/set-user-status'
import { showToast } from '@/src/components/ui/toast'

type OpenMenu = string | null

type UsersSectionProps = {
  initialUsers: User[]
  availableRoles?: Role[]
  currentUserId?: string
  canAddUser?: boolean
}

export default function UsersSection({
  initialUsers,
  availableRoles = [],
  currentUserId,
  canAddUser = false,
}: UsersSectionProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<User | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)
  const [drawerUser, setDrawerUser] = useState<User | null>(null)

  const filtered = useMemo(() => {
    return initialUsers.filter((u) => {
      const searchLower = search.toLowerCase()
      const matchesSearch =
        u.email.toLowerCase().includes(searchLower) ||
        (u.name && u.name.toLowerCase().includes(searchLower)) ||
        (u.firstName && u.firstName.toLowerCase().includes(searchLower)) ||
        (u.lastName && u.lastName.toLowerCase().includes(searchLower)) ||
        (u.employee?.firstName && u.employee.firstName.toLowerCase().includes(searchLower)) ||
        (u.employee?.lastName && u.employee.lastName.toLowerCase().includes(searchLower))
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && u.isActive) ||
        (statusFilter === 'Inactive' && !u.isActive)
      return matchesSearch && matchesStatus
    })
  }, [initialUsers, search, statusFilter])

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

  const handleAssignRole = (user: User) => {
    setAssignTarget(user)
    setOpenMenu(null)
    setDrawerUser(null)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search users by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-400 lg:max-w-sm"
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400"
            >
              <option>All</option>
              <option>Active</option>
              <option>Inactive</option>
            </select>
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
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
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
              {filtered.length > 0 ? (
                filtered.map((user, index) => {
                  const isNearBottom = index >= filtered.length - 3
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

      {/* Pagination placeholder */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-3 text-center text-sm text-zinc-500">
          Showing {filtered.length} of {initialUsers.length} users
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

      <UserDetailDrawer
        user={drawerUser}
        onClose={() => setDrawerUser(null)}
        isSelf={drawerUser?.id === currentUserId}
        onAssignRole={handleAssignRole}
        onToggleActive={handleToggleActive}
        onDelete={handleDelete}
      />
    </>
  )
}
