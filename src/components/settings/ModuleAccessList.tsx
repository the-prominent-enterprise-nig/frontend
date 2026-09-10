'use client'

import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type Permission } from '@/src/schema/settings/list'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  SETTABLE_ACCESS_LEVELS,
  applyResourceLevel,
  countEffectivePermissions,
  formatResourceLabel,
  getAccessLevelForPermissions,
  getModulePermissions,
  getResourceRows,
  getSelectedPermissionIdsForLevel,
  type AccessLevel,
} from './access-levels'

type ModuleAccessListProps = {
  availablePermissions: Permission[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  /**
   * Module keys in the order rows should render. Manage Role Access freezes
   * this on open so rows don't move while you edit; Create Role omits it and
   * gets plain alphabetical.
   */
  moduleOrder?: string[]
}

/**
 * The module/resource access grid, shared by Create Role and Manage Role
 * Access — which previously carried a byte-identical copy of the module rows
 * each, so every change had to be made twice.
 *
 * Two tiers. The module buttons set every resource in the module at once, which
 * is all the editor used to offer: Accounting has 30 resources, so "View Only"
 * meant read on all 30, and anything narrower meant hunting through ~400
 * checkboxes under Advanced permissions. Expanding a module exposes the same
 * four levels per resource, so "read AR invoices and nothing else in
 * accounting" is two clicks.
 *
 * Resource lists get long — inventory has 43, accounting 30 — against roughly
 * 600px of usable modal height. Three things keep that navigable: only one
 * module is open at a time, its resources filter by name, and they lay out two
 * per row on wide screens.
 */
export default function ModuleAccessList({
  availablePermissions,
  selected,
  onChange,
  moduleOrder,
}: ModuleAccessListProps) {
  // One module open at a time. Expanding every module would otherwise stack to
  // ~5,300px of resource rows in a modal that shows ~600px.
  const [expandedModule, setExpandedModule] = useState<string | null>(null)
  const [resourceQuery, setResourceQuery] = useState('')

  const moduleRows = useMemo(() => {
    return ACCESS_MODULES.map((moduleConfig) => {
      const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
      const selectedModulePermissions = modulePermissions.filter((permission) =>
        selected.has(permission.id)
      )

      return {
        moduleConfig,
        modulePermissions,
        permissionCount: modulePermissions.length,
        selectedCount: countEffectivePermissions(modulePermissions, selectedModulePermissions),
        level: getAccessLevelForPermissions(selectedModulePermissions, modulePermissions),
      }
    }).sort((a, b) => {
      if (moduleOrder) {
        return moduleOrder.indexOf(a.moduleConfig.key) - moduleOrder.indexOf(b.moduleConfig.key)
      }
      return a.moduleConfig.label.localeCompare(b.moduleConfig.label)
    })
  }, [availablePermissions, selected, moduleOrder])

  function handleModuleLevelChange(moduleKey: string, level: Exclude<AccessLevel, 'mixed'>) {
    const moduleConfig = ACCESS_MODULES.find((item) => item.key === moduleKey)
    if (!moduleConfig) return

    const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
    const nextIds = new Set(
      getSelectedPermissionIdsForLevel(availablePermissions, moduleConfig, level)
    )

    const next = new Set(selected)
    for (const permission of modulePermissions) next.delete(permission.id)
    for (const id of nextIds) next.add(id)
    onChange(next)
  }

  function handleResourceLevelChange(
    resourcePermissions: Permission[],
    level: Exclude<AccessLevel, 'mixed'>
  ) {
    onChange(applyResourceLevel(selected, resourcePermissions, level))
  }

  function toggleExpanded(moduleKey: string) {
    setExpandedModule((current) => (current === moduleKey ? null : moduleKey))
    // The filter belongs to whichever module is open, so a stale query never
    // greets you with an empty list after switching.
    setResourceQuery('')
  }

  return (
    <div className="space-y-3">
      {moduleRows.map(
        ({ moduleConfig, modulePermissions, level, permissionCount, selectedCount }) => {
          const isExpanded = expandedModule === moduleConfig.key
          const allResourceRows = isExpanded ? getResourceRows(modulePermissions, selected) : []
          const query = resourceQuery.trim().toLowerCase()
          const resourceRows = query
            ? allResourceRows.filter(
                (row) =>
                  row.resource.toLowerCase().includes(query) ||
                  formatResourceLabel(row.resource).toLowerCase().includes(query)
              )
            : allResourceRows

          return (
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
                  <button
                    type="button"
                    onClick={() => toggleExpanded(moduleConfig.key)}
                    aria-expanded={isExpanded}
                    className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 hover:text-prominent-purple-700"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-zinc-400" />
                    )}
                    {moduleConfig.label}
                  </button>
                  <p className="mt-1 pl-5 text-xs text-zinc-500">
                    {selectedCount} of {permissionCount} capabilities enabled
                  </p>
                  {level === 'mixed' && (
                    <p className="mt-1 pl-5 text-xs font-medium text-orange-700">
                      Resources in this module are at different levels. Expand to see which, or pick
                      a level to make the whole module uniform.
                    </p>
                  )}
                </div>

                <div className="grid flex-1 grid-cols-2 gap-2 md:grid-cols-4">
                  {SETTABLE_ACCESS_LEVELS.map((accessLevel) => (
                    <button
                      key={accessLevel}
                      type="button"
                      onClick={() => handleModuleLevelChange(moduleConfig.key, accessLevel)}
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

              {isExpanded && (
                <div className="mt-4 border-t border-zinc-200/70 pt-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      Per resource — the buttons above set all of these at once
                    </p>
                    {allResourceRows.length > 8 && (
                      <div className="relative sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={resourceQuery}
                          onChange={(event) => setResourceQuery(event.target.value)}
                          placeholder={`Filter ${allResourceRows.length} resources...`}
                          className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none focus:border-zinc-400"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid gap-1.5 lg:grid-cols-2">
                    {resourceRows.map((row) => (
                      <div
                        key={row.resource}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white/70 px-2.5 py-1.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-medium text-zinc-800">
                            {formatResourceLabel(row.resource)}
                          </p>
                          <p className="text-[11px] text-zinc-400">
                            {row.effectiveCount} of {row.permissions.length}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          {SETTABLE_ACCESS_LEVELS.map((accessLevel) => (
                            <button
                              key={accessLevel}
                              type="button"
                              title={ACCESS_LEVEL_LABELS[accessLevel]}
                              onClick={() =>
                                handleResourceLevelChange(row.permissions, accessLevel)
                              }
                              className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                                row.level === accessLevel
                                  ? 'border-prominent-purple-500 bg-prominent-purple-700 text-white'
                                  : 'border-zinc-200 bg-white text-zinc-600 hover:border-prominent-purple-200 hover:bg-prominent-purple-50'
                              }`}
                            >
                              {SHORT_LEVEL_LABELS[accessLevel]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {resourceRows.length === 0 && (
                    <p className="py-4 text-center text-xs text-zinc-500">
                      No resources match &ldquo;{resourceQuery}&rdquo;.
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        }
      )}
    </div>
  )
}

/**
 * Resource rows sit two-up inside the modal, so the level buttons get roughly a
 * quarter of half its width. Full labels ("Manage / Edit") do not fit; the full
 * text stays available as the button's title attribute.
 */
const SHORT_LEVEL_LABELS: Record<Exclude<AccessLevel, 'mixed'>, string> = {
  none: 'None',
  view: 'View',
  manage: 'Edit',
  full: 'Full',
}
