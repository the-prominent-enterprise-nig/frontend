'use client'

import { ChevronDown, ChevronRight, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type Permission } from '@/src/schema/settings/list'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  SETTABLE_ACCESS_LEVELS,
  countEffectivePermissions,
  formatPermission,
  getAccessLevelForPermissions,
  getModulePermissions,
  getSelectedPermissionIdsForLevel,
  type AccessLevel,
} from './access-levels'

export type CreateRoleFormData = {
  name: string
  description: string
  permissionIds: string[]
}

type CreateRoleModalProps = {
  isOpen: boolean
  availablePermissions: Permission[]
  onClose: () => void
  onSave: (data: CreateRoleFormData) => void
}

export default function CreateRoleModal({
  isOpen,
  availablePermissions,
  onClose,
  onSave,
}: CreateRoleModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const moduleRows = useMemo(() => {
    return ACCESS_MODULES.map((moduleConfig) => {
      const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
      const selectedModulePermissions = modulePermissions.filter((permission) =>
        selected.has(permission.id)
      )

      return {
        moduleConfig,
        permissionCount: modulePermissions.length,
        selectedCount: countEffectivePermissions(modulePermissions, selectedModulePermissions),
        level: getAccessLevelForPermissions(selectedModulePermissions, modulePermissions),
      }
    }).sort((a, b) => {
      if (a.level !== 'none' && b.level === 'none') return -1
      if (a.level === 'none' && b.level !== 'none') return 1
      return a.moduleConfig.label.localeCompare(b.moduleConfig.label)
    })
  }, [availablePermissions, selected])

  const advancedGroups = useMemo(() => {
    const query = search.trim().toLowerCase()

    return ACCESS_MODULES.map((moduleConfig) => {
      const modulePermissions = getModulePermissions(availablePermissions, moduleConfig).filter(
        (permission) => {
          if (!query) return true
          const key = `${permission.module}:${permission.resource}:${permission.action}`
          return key.includes(query) || formatPermission(permission).toLowerCase().includes(query)
        }
      )
      return { moduleConfig, permissions: modulePermissions }
    }).filter((group) => group.permissions.length > 0)
  }, [availablePermissions, search])

  if (!isOpen) return null

  function resetState() {
    setName('')
    setDescription('')
    setNameError('')
    setSelected(new Set())
    setSearch('')
    setAdvancedOpen(false)
    setExpandedModules(new Set())
  }

  const handleSave = () => {
    if (!name.trim()) {
      setNameError('Role name is required.')
      return
    }
    if (name.length > 100) {
      setNameError('Role name must be 100 characters or fewer.')
      return
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      permissionIds: Array.from(selected),
    })
    resetState()
    onClose()
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  function handleAccessLevelChange(moduleKey: string, level: Exclude<AccessLevel, 'mixed'>) {
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

  function toggleModuleExpanded(moduleKey: string) {
    setExpandedModules((prev) => {
      const next = new Set(prev)
      if (next.has(moduleKey)) next.delete(moduleKey)
      else next.add(moduleKey)
      return next
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Create Role</h2>
            <p className="mt-0.5 text-sm text-zinc-500">Define a new role for the system.</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError('')
                }}
                placeholder="e.g. HR Manager"
                maxLength={100}
                className={`w-full max-w-md rounded-lg border px-3 py-2 text-sm outline-none transition ${
                  nameError
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-zinc-200 focus:border-zinc-400'
                }`}
              />
              {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what this role is for..."
                rows={2}
                maxLength={255}
                className="w-full max-w-md rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none transition focus:border-zinc-400"
              />
              <p className="max-w-md text-right text-xs text-zinc-400">{description.length}/255</p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-zinc-900">Access</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Choose which modules this role can see and what they can do inside each module. Users
              see modules in the top menu when their role has at least View Only access.
            </p>

            <div className="mt-3 space-y-3">
              {moduleRows.map(({ moduleConfig, level, permissionCount, selectedCount }) => (
                <div
                  key={moduleConfig.key}
                  className={`rounded-xl border p-4 ${
                    level === 'none'
                      ? 'border-zinc-200 bg-white'
                      : level === 'mixed'
                        ? 'border-orange-300 bg-orange-50/60'
                        : 'border-prominent-purple-200 bg-prominent-purple-50/50'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-52">
                      <h4 className="text-sm font-semibold text-zinc-900">{moduleConfig.label}</h4>
                      <p className="mt-1 text-xs text-zinc-500">
                        {selectedCount} of {permissionCount} capabilities enabled
                      </p>
                      {level === 'mixed' && (
                        <p className="mt-1 text-xs font-medium text-orange-700">
                          Different resources in this module currently have different access levels.
                          Pick a level below to make it uniform, or use Advanced permissions to
                          review what&apos;s actually granted.
                        </p>
                      )}
                    </div>

                    <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
                      {SETTABLE_ACCESS_LEVELS.map((accessLevel) => (
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
                      {selected.size} granular permissions selected
                    </p>
                  </div>

                  <div className="space-y-2">
                    {advancedGroups.map(({ moduleConfig, permissions }) => {
                      const isSearching = search.trim().length > 0
                      const isExpanded = isSearching || expandedModules.has(moduleConfig.key)
                      const selectedInGroup = permissions.filter((permission) =>
                        selected.has(permission.id)
                      ).length

                      return (
                        <div key={moduleConfig.key} className="rounded-lg border border-zinc-200">
                          <button
                            type="button"
                            onClick={() => toggleModuleExpanded(moduleConfig.key)}
                            className="flex w-full items-center justify-between px-3 py-2 text-left"
                          >
                            <span className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-zinc-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-zinc-400" />
                              )}
                              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                                {moduleConfig.label}
                              </span>
                            </span>
                            <span className="text-xs text-zinc-400">
                              {selectedInGroup} of {permissions.length} selected
                            </span>
                          </button>

                          {isExpanded && (
                            <div className="grid gap-2 border-t border-zinc-100 p-3 md:grid-cols-2">
                              {permissions.map((permission) => {
                                const isWildcard =
                                  permission.resource === '*' && permission.action === '*'
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
                                        {isWildcard
                                          ? `All ${moduleConfig.label} capabilities`
                                          : formatPermission(permission)}
                                      </p>
                                      <p className="mt-0.5 font-mono text-xs text-zinc-400">
                                        {permissionKey}
                                      </p>
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {advancedGroups.length === 0 && (
                    <p className="py-8 text-center text-sm text-zinc-500">
                      No permissions match your search.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
          <p className="text-sm text-zinc-500">
            <span className="font-semibold text-zinc-700">{selected.size}</span> capabilities
            selected
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-lg bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-prominent-purple-800"
            >
              Create Role
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
