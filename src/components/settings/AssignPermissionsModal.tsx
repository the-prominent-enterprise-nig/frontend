'use client'

import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type Permission, type Role } from '@/src/schema/settings/list'
import { assignPermissions } from '@/src/app/(app)/(dashboard)/settings/_actions'
import { showToast } from '@/src/components/ui/toast'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  formatPermission,
  getAccessLevelForPermissions,
  getModulePermissions,
  getSelectedPermissionIdsForLevel,
  type AccessLevel,
} from './access-levels'

type AssignPermissionsModalProps = {
  role: Role
  availablePermissions: Permission[]
  isOpen: boolean
  onClose: () => void
}

export default function AssignPermissionsModal({
  role,
  availablePermissions,
  isOpen,
  onClose,
}: AssignPermissionsModalProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (role && isOpen) {
      setSelected(new Set(role.permissions.map((rolePermission) => rolePermission.permission.id)))
      setAdvancedOpen(false)
      setSearch('')
    }
  }, [role, isOpen])

  const moduleRows = useMemo(() => {
    return ACCESS_MODULES.map((moduleConfig) => {
      const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
      const selectedModulePermissions = modulePermissions.filter((permission) =>
        selected.has(permission.id)
      )

      return {
        moduleConfig,
        permissionCount: modulePermissions.length,
        selectedCount: selectedModulePermissions.length,
        level: getAccessLevelForPermissions(selectedModulePermissions),
      }
    }).sort((a, b) => {
      if (a.level !== 'none' && b.level === 'none') return -1
      if (a.level === 'none' && b.level !== 'none') return 1
      return a.moduleConfig.label.localeCompare(b.moduleConfig.label)
    })
  }, [availablePermissions, selected])

  const filteredAdvancedPermissions = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return availablePermissions

    return availablePermissions.filter((permission) => {
      const key = `${permission.module}:${permission.resource}:${permission.action}`
      return key.includes(query) || formatPermission(permission).toLowerCase().includes(query)
    })
  }, [availablePermissions, search])

  const selectedAdvancedCount = useMemo(() => {
    return availablePermissions.filter((permission) => selected.has(permission.id)).length
  }, [availablePermissions, selected])

  function handleAccessLevelChange(moduleKey: string, level: AccessLevel) {
    const moduleConfig = ACCESS_MODULES.find((item) => item.key === moduleKey)
    if (!moduleConfig) return

    const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
    const nextModulePermissionIds = new Set(
      getSelectedPermissionIdsForLevel(availablePermissions, moduleConfig, level)
    )

    setSelected((prev) => {
      const next = new Set(prev)
      for (const permission of modulePermissions) {
        next.delete(permission.id)
      }
      for (const permissionId of nextModulePermissionIds) {
        next.add(permissionId)
      }
      return next
    })
  }

  function handleToggleAdvancedPermission(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    setIsSaving(true)

    try {
      const result = await assignPermissions({
        roleId: role.id,
        permissionIds: Array.from(selected),
      })

      if (!result.success) {
        showToast({
          title: 'Failed to update access',
          description: result.message || result.error,
          status: 'error',
        })
        return
      }

      showToast({
        title: 'Role access updated',
        description: `${role.name} access has been updated.`,
        status: 'success',
      })

      router.refresh()
      onClose()
    } catch (error) {
      showToast({
        title: 'Failed to update access',
        description: error instanceof Error ? error.message : 'Unknown error',
        status: 'error',
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Manage Role Access</h2>
            <p className="mt-0.5 text-sm text-zinc-500">
              Role: <span className="font-medium text-zinc-700">{role.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-3">
          <p className="text-sm text-zinc-600">
            Choose which modules this role can see and what they can do inside each module. Users
            see modules in the top menu when their role has at least View Only access.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-3">
            {moduleRows.map(({ moduleConfig, level, permissionCount, selectedCount }) => (
              <div
                key={moduleConfig.key}
                className={`rounded-xl border p-4 ${
                  level === 'none'
                    ? 'border-zinc-200 bg-white'
                    : 'border-prominent-purple-200 bg-prominent-purple-50/50'
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-52">
                    <h3 className="text-sm font-semibold text-zinc-900">{moduleConfig.label}</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      {selectedCount} of {permissionCount} capabilities enabled
                    </p>
                  </div>

                  <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
                    {(Object.keys(ACCESS_LEVEL_LABELS) as AccessLevel[]).map((accessLevel) => (
                      <button
                        key={accessLevel}
                        type="button"
                        onClick={() => handleAccessLevelChange(moduleConfig.key, accessLevel)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          level === accessLevel
                            ? 'border-prominent-purple-500 bg-prominent-purple-700 text-white shadow-sm'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-prominent-purple-200 hover:bg-prominent-purple-50'
                        }`}
                      >
                        {ACCESS_LEVEL_LABELS[accessLevel]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-zinc-200 bg-white">
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-semibold text-zinc-900">
                  Advanced permissions
                </span>
                <span className="text-xs text-zinc-500">
                  Fine tune individual capabilities only when needed.
                </span>
              </span>
              <span className="text-xs font-semibold text-prominent-purple-700">
                {advancedOpen ? 'Hide' : 'Show'}
              </span>
            </button>

            {advancedOpen && (
              <div className="border-t border-zinc-200 p-4">
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search advanced permissions..."
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-zinc-400"
                    />
                  </div>
                  <p className="text-xs text-zinc-500">
                    {selectedAdvancedCount} granular permissions selected
                  </p>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {filteredAdvancedPermissions.map((permission) => {
                    const permissionKey = `${permission.module}:${permission.resource}:${permission.action}`

                    return (
                      <label
                        key={permission.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                          selected.has(permission.id)
                            ? 'border-prominent-purple-300 bg-prominent-purple-50'
                            : 'border-zinc-200 hover:bg-zinc-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(permission.id)}
                          onChange={() => handleToggleAdvancedPermission(permission.id)}
                          className="mt-0.5 h-4 w-4 accent-prominent-purple-700"
                        />
                        <div>
                          <p className="text-sm font-medium text-zinc-800">
                            {formatPermission(permission)}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-zinc-400">{permissionKey}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>

                {filteredAdvancedPermissions.length === 0 && (
                  <p className="py-8 text-center text-sm text-zinc-500">
                    No permissions match your search.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-700">{selected.size}</span> capabilities
            selected
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Access'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
