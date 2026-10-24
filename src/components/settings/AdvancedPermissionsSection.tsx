'use client'

import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type Permission } from '@/src/schema/settings/list'
import { formatPermission, getAllPermissionGroups, isPresetExcluded } from './access-levels'

type AdvancedPermissionsSectionProps = {
  availablePermissions: Permission[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}

/**
 * The collapsible "fine tune individual capabilities" card, shared by
 * Manage Access and Create Role — same reasoning as ModuleAccessList's own
 * extraction: this used to be a near-identical copy in each, so a change
 * (the Sensitive badge, the amber vs orange fix, ring-consistent styling)
 * had to land twice or drift apart.
 *
 * All permissions, not just the 4 real modules ACCESS_MODULES covers (#171
 * review) — admin/files/etc. have no quick-preset button but stay
 * individually grantable here.
 */
export default function AdvancedPermissionsSection({
  availablePermissions,
  selected,
  onChange,
}: AdvancedPermissionsSectionProps) {
  const [search, setSearch] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())

  const advancedGroups = useMemo(() => {
    const query = search.trim().toLowerCase()

    return getAllPermissionGroups(availablePermissions)
      .map((moduleConfig) => {
        const modulePermissions = availablePermissions.filter(
          (permission) =>
            permission.module === moduleConfig.key &&
            (!query ||
              `${permission.module}:${permission.resource}:${permission.action}`.includes(query) ||
              formatPermission(permission).toLowerCase().includes(query))
        )
        return { moduleConfig, permissions: modulePermissions }
      })
      .filter((group) => group.permissions.length > 0)
  }, [availablePermissions, search])

  const selectedAdvancedCount = useMemo(() => {
    return availablePermissions.filter((permission) => selected.has(permission.id)).length
  }, [availablePermissions, selected])

  function handleToggleAdvancedPermission(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
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
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setAdvancedOpen((value) => !value)}
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-colors hover:bg-zinc-50/60"
      >
        <span>
          <span className="block text-sm font-semibold text-zinc-900">Advanced permissions</span>
          <span className="text-xs text-zinc-500">
            Fine tune individual capabilities only when needed.
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-prominent-purple-700">
          {advancedOpen ? 'Hide' : 'Show'}
          {advancedOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
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
                className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
              />
            </div>
            <p className="text-xs text-zinc-500">
              {selectedAdvancedCount} granular{' '}
              {selectedAdvancedCount === 1 ? 'permission' : 'permissions'} selected
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
                <div
                  key={moduleConfig.key}
                  className="overflow-hidden rounded-xl border border-zinc-200"
                >
                  <button
                    type="button"
                    onClick={() => toggleModuleExpanded(moduleConfig.key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-zinc-50"
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
                        const isWildcard = permission.resource === '*' && permission.action === '*'
                        const permissionKey = `${permission.module}:${permission.resource}:${permission.action}`

                        return (
                          <label
                            key={permission.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
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
                              {isPresetExcluded(permission) && (
                                <p className="mt-1 text-xs font-medium text-amber-700">
                                  Sensitive — never granted by the module buttons above. Tick it
                                  here to grant it.
                                </p>
                              )}
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
  )
}
