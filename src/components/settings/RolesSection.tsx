'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Trash2, ShieldCheck } from 'lucide-react'
import CreateRoleModal, { type CreateRoleFormData } from './CreateRoleModal'
import AssignPermissionsModal from './AssignPermissionsModal'
import { type Role, type Permission } from '@/src/schema/settings/list'
import { createRole } from '@/src/app/(app)/(dashboard)/settings/_actions'
import { showToast } from '@/src/components/ui/toast'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  getAccessLevelForRole,
  type AccessLevel,
} from './access-levels'

type OpenMenu = string | null

type RolesSectionProps = {
  initialRoles: Role[]
  availablePermissions?: Permission[]
}

function getAccessBadgeClass(level: AccessLevel): string {
  if (level === 'full') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (level === 'manage') return 'bg-blue-50 text-blue-700 ring-blue-200'
  if (level === 'view') return 'bg-amber-50 text-amber-700 ring-amber-200'
  return 'bg-zinc-100 text-zinc-500 ring-zinc-200'
}

export default function RolesSection({
  initialRoles,
  availablePermissions = [],
}: RolesSectionProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [assignTarget, setAssignTarget] = useState<Role | null>(null)
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null)

  const filtered = useMemo(() => {
    return initialRoles.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
      const matchesStatus =
        statusFilter === 'All' ||
        (statusFilter === 'Active' && r.isActive) ||
        (statusFilter === 'Inactive' && !r.isActive)
      return matchesSearch && matchesStatus
    })
  }, [initialRoles, search, statusFilter])

  const handleCreate = async (data: CreateRoleFormData) => {
    try {
      const result = await createRole({
        name: data.name,
        // Note: permissionIds can be assigned later via the AssignPermissionsModal
        // The isActive and description fields are ignored by the API for now
      })

      if (!result.success) {
        showToast({
          title: 'Failed to create role',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role created successfully',
        description: `${data.name} has been added`,
        status: 'success',
      })

      // Refresh server data and close modal
      router.refresh()
      setIsCreateOpen(false)
    } catch (error) {
      showToast({
        title: 'Failed to create role',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    }
  }

  const handleToggleActive = (id: string) => {
    // TODO: Implement toggle active API call
    console.log('Toggle active:', id)
    setOpenMenu(null)
  }

  const handleDelete = (id: string) => {
    // TODO: Implement delete role API call
    console.log('Delete role:', id)
    setOpenMenu(null)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <input
            type="text"
            placeholder="Search roles..."
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
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              + Add Role
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-100 text-zinc-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Role Name</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Module Access</th>
                <th className="px-4 py-3 text-left font-medium">Permissions</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((role, index) => {
                  const isNearBottom = index >= filtered.length - 3
                  const moduleAccess = ACCESS_MODULES.map((moduleConfig) => ({
                    moduleConfig,
                    level: getAccessLevelForRole(role, moduleConfig),
                  })).filter((item) => item.level !== 'none')
                  return (
                    <tr key={role.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-4 py-3 font-medium text-zinc-900">{role.name}</td>
                      <td className="max-w-xs px-4 py-3 text-zinc-600">
                        {role.description || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {moduleAccess.length > 0 ? (
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {moduleAccess.map(({ moduleConfig, level }) => (
                              <span
                                key={moduleConfig.key}
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${getAccessBadgeClass(level)}`}
                              >
                                {moduleConfig.label}: {ACCESS_LEVEL_LABELS[level]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">No module access</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setAssignTarget(role)}
                          className="inline-flex items-center gap-1.5 rounded-full bg-prominent-purple-50 px-3 py-1 text-xs font-medium text-prominent-purple-700 transition hover:bg-prominent-purple-100"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {role.permissions.length} permissions
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            role.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-zinc-200 text-zinc-600'
                          }`}
                        >
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenMenu(openMenu === role.id ? null : role.id)}
                            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                          {openMenu === role.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenMenu(null)}
                              />
                              <div
                                className={`absolute right-0 z-50 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-44 rounded-xl border border-zinc-200 bg-white shadow-lg`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setAssignTarget(role)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                                >
                                  <ShieldCheck className="h-4 w-4 text-prominent-purple-600" />
                                  Assign
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleToggleActive(role.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                                >
                                  <Pencil className="h-4 w-4 text-zinc-500" />
                                  {role.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(role.id)}
                                  className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-zinc-500">
                    No roles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateRoleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSave={handleCreate}
      />

      {assignTarget && (
        <AssignPermissionsModal
          role={assignTarget}
          availablePermissions={availablePermissions}
          isOpen={true}
          onClose={() => setAssignTarget(null)}
        />
      )}
    </>
  )
}
