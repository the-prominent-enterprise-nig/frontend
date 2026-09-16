'use client'

import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { type Permission } from '@/src/schema/settings/list'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  SETTABLE_ACCESS_LEVELS,
  SHORT_ACCESS_LEVEL_LABELS,
  applyResourceLevel,
  countEffectivePermissions,
  formatPermission,
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
  // Per-resource detail expansion — click a resource's name to see its full
  // capability list in place, not a hover tooltip that vanishes as soon as
  // the mouse moves off. Only one module is ever open at a time, so keying
  // purely by resource name is safe.
  const [expandedResources, setExpandedResources] = useState<Set<string>>(new Set())

  const moduleRows = useMemo(() => {
    return ACCESS_MODULES.map((moduleConfig) => {
      const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
      const selectedModulePermissions = modulePermissions.filter((permission) =>
        selected.has(permission.id)
      )
      const wildcardPermission = modulePermissions.find((permission) => permission.resource === '*')

      return {
        moduleConfig,
        modulePermissions,
        permissionCount: modulePermissions.length,
        selectedCount: countEffectivePermissions(modulePermissions, selectedModulePermissions),
        level: getAccessLevelForPermissions(selectedModulePermissions, modulePermissions),
        // Full Access via applyResourceLevel's per-resource buttons always
        // collapses back to this row when every resource ends up covered
        // (see collapseToWildcardIfComplete) — but Advanced permissions'
        // checkboxes toggle individual rows directly and never run that
        // collapse, so a module can still reach 100% one box at a time
        // without ever picking the wildcard back up. #169 review
        // (2026-09-16): that gap is what this flags.
        holdsWildcard: wildcardPermission ? selected.has(wildcardPermission.id) : false,
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
    modulePermissions: Permission[],
    resourcePermissions: Permission[],
    level: Exclude<AccessLevel, 'mixed'>
  ) {
    onChange(applyResourceLevel(selected, modulePermissions, resourcePermissions, level))
  }

  function toggleExpanded(moduleKey: string) {
    setExpandedModule((current) => (current === moduleKey ? null : moduleKey))
    // The filter belongs to whichever module is open, so a stale query never
    // greets you with an empty list after switching.
    setResourceQuery('')
    setExpandedResources(new Set())
  }

  function toggleResourceExpanded(resource: string) {
    setExpandedResources((current) => {
      const next = new Set(current)
      if (next.has(resource)) next.delete(resource)
      else next.add(resource)
      return next
    })
  }

  return (
    <div className="space-y-3">
      {moduleRows.map(
        ({
          moduleConfig,
          modulePermissions,
          level,
          permissionCount,
          selectedCount,
          holdsWildcard,
        }) => {
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
              className={`rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)] transition-colors ${
                level === 'mixed'
                  ? 'border-l-4 border-l-amber-400'
                  : level !== 'none'
                    ? 'border-l-4 border-l-prominent-purple-600'
                    : ''
              }`}
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 lg:flex-1">
                  <button
                    type="button"
                    onClick={() => toggleExpanded(moduleConfig.key)}
                    aria-expanded={isExpanded}
                    className="flex items-center gap-1.5 text-sm font-semibold text-zinc-900 transition-colors hover:text-prominent-purple-700"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />
                    )}
                    {moduleConfig.label}
                  </button>
                  <p className="mt-1 pl-5 text-xs text-zinc-500">
                    {selectedCount} of {permissionCount} capabilities enabled
                  </p>
                </div>

                <div className="grid shrink-0 grid-cols-2 gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1 sm:grid-cols-4">
                  {SETTABLE_ACCESS_LEVELS.map((accessLevel) => (
                    <button
                      key={accessLevel}
                      type="button"
                      onClick={() => handleModuleLevelChange(moduleConfig.key, accessLevel)}
                      className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 sm:text-sm ${
                        level === accessLevel
                          ? 'bg-prominent-purple-700 text-white shadow-sm'
                          : 'text-zinc-600 hover:bg-white hover:text-zinc-900'
                      }`}
                    >
                      {ACCESS_LEVEL_LABELS[accessLevel]}
                    </button>
                  ))}
                </div>
              </div>

              {level === 'mixed' && (
                <p className="mt-2 text-xs font-medium text-amber-700">
                  Resources are at different levels — expand to see which.
                </p>
              )}

              {level === 'full' && !holdsWildcard && (
                <p className="mt-2 text-xs text-zinc-400">
                  Granted individually — new {moduleConfig.label} permissions won&apos;t be included
                  automatically.
                </p>
              )}

              {isExpanded && (
                <div className="mt-4 border-t border-zinc-200/70 pt-3">
                  <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                        Per resource — the buttons above set all of these at once
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-400">
                        Click a level to set it — the active one stays highlighted. Click a
                        resource&apos;s name for the full breakdown.
                      </p>
                    </div>
                    {allResourceRows.length > 8 && (
                      <div className="relative sm:w-56">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={resourceQuery}
                          onChange={(event) => setResourceQuery(event.target.value)}
                          placeholder={`Filter ${allResourceRows.length} resources...`}
                          className="w-full rounded-lg border border-zinc-200 bg-white py-1.5 pl-8 pr-2 text-xs outline-none transition focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
                        />
                      </div>
                    )}
                  </div>

                  {(() => {
                    // Two independently-flowing columns, not a CSS grid with
                    // synced row tracks — a grid ties every item in a row to
                    // the same height, so expanding one resource in column A
                    // would stretch (or blank-pad) whatever sits beside it in
                    // column B, even though the two have nothing to do with
                    // each other. Splitting into two plain stacks means
                    // column B never reacts to anything happening in A.
                    const renderRow = (row: (typeof resourceRows)[number]) => {
                      const isResourceExpanded = expandedResources.has(row.resource)
                      return (
                        <div
                          key={row.resource}
                          className={`overflow-hidden rounded-lg border transition-colors ${
                            isResourceExpanded
                              ? 'border-prominent-purple-200 bg-white'
                              : 'border-transparent bg-white hover:border-zinc-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 py-1.5 pl-2 pr-2.5">
                            <button
                              type="button"
                              onClick={() => toggleResourceExpanded(row.resource)}
                              aria-expanded={isResourceExpanded}
                              className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              {isResourceExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-prominent-purple-500" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-300 group-hover:text-zinc-400" />
                              )}
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-1.5">
                                  <span className="truncate text-[13px] font-medium text-zinc-800">
                                    {formatResourceLabel(row.resource)}
                                  </span>
                                  <span className="shrink-0 text-[11px] text-zinc-400">
                                    {row.effectiveCount} of {row.permissions.length}
                                  </span>
                                </span>
                              </span>
                            </button>
                            <div className="flex shrink-0 gap-0.5 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
                              {row.availability.map(
                                ({ level: accessLevel, enabled, reason, grants }) => (
                                  <button
                                    key={accessLevel}
                                    type="button"
                                    disabled={!enabled}
                                    title={
                                      reason ??
                                      (accessLevel === 'none'
                                        ? 'Removes all access to this resource.'
                                        : grants.join('\n'))
                                    }
                                    onClick={() =>
                                      handleResourceLevelChange(
                                        modulePermissions,
                                        row.permissions,
                                        accessLevel
                                      )
                                    }
                                    className={`rounded-md px-2 py-1 text-[11px] transition-colors ${
                                      row.level === accessLevel
                                        ? 'bg-prominent-purple-700 font-semibold text-white shadow-[0_1px_3px_0_rgb(109_40_217/0.5),0_1px_2px_-1px_rgb(109_40_217/0.5)] ring-1 ring-prominent-purple-800'
                                        : !enabled
                                          ? 'cursor-not-allowed font-medium text-zinc-300'
                                          : 'font-medium text-zinc-600 hover:bg-white hover:text-zinc-900'
                                    }`}
                                  >
                                    {SHORT_ACCESS_LEVEL_LABELS[accessLevel]}
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          {isResourceExpanded && (
                            <div className="space-y-1 border-t border-zinc-100 bg-zinc-50/60 px-3 py-2.5 pl-8">
                              {row.permissions.map((permission) => {
                                const isGranted = row.selectedPermissions.some(
                                  (selectedPermission) => selectedPermission.id === permission.id
                                )
                                return (
                                  <div
                                    key={permission.id}
                                    className="flex items-start gap-1.5 text-[12px] leading-snug"
                                  >
                                    <span
                                      className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${
                                        isGranted ? 'bg-prominent-purple-600' : 'bg-zinc-300'
                                      }`}
                                    />
                                    <span className={isGranted ? 'text-zinc-700' : 'text-zinc-400'}>
                                      {formatPermission(permission)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    }

                    return (
                      <div className="grid items-start gap-3 lg:grid-cols-2">
                        <div className="space-y-1.5">
                          {resourceRows.filter((_, index) => index % 2 === 0).map(renderRow)}
                        </div>
                        <div className="space-y-1.5">
                          {resourceRows.filter((_, index) => index % 2 === 1).map(renderRow)}
                        </div>
                      </div>
                    )
                  })()}

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
