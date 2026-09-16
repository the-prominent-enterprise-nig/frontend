'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronDown,
  MoreHorizontal,
  Plus,
  PowerOff,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react'
import { type Role, type Permission } from '@/src/schema/settings/list'
import { deleteRole, reactivateRole } from '@/src/app/(app)/(dashboard)/settings/_actions'
import { showToast } from '@/src/components/ui/toast'
import {
  ACCESS_LEVEL_LABELS,
  ACCESS_MODULES,
  SHORT_ACCESS_LEVEL_LABELS,
  countEffectivePermissions,
  getAccessLevelForRole,
  type AccessLevel,
} from './access-levels'

// Default roles — cannot be deactivated
const PROTECTED_ROLE_NAMES = new Set([
  'Business Owner',
  'Branch Manager',
  'Accountant',
  'Stock Controller',
  'Cashier',
  'Marketing Manager',
])

type OpenMenu = string | null

type RolesSectionProps = {
  initialRoles: Role[]
  availablePermissions?: Permission[]
}

// Chips read as neutral tags (bordered, not filled) — a colored dot carries
// the state instead. Same restrained language as the Status column, and it
// keeps four chips in a row from turning into a wall of saturated color.
//
// Mixed gets its own render (a hollow ring, not a solid fill) rather than a
// class here — it used to share View's solid amber dot, which made "every
// resource is View" and "resources are at different levels, some may not be
// View at all" look identical at a glance. A ring reads as "partial" on its
// own, no new color needed.
function getAccessDotClass(level: Exclude<AccessLevel, 'mixed'>): string {
  if (level === 'full') return 'bg-emerald-500'
  if (level === 'manage') return 'bg-blue-500'
  if (level === 'view') return 'bg-amber-500'
  return 'bg-zinc-300'
}

export default function RolesSection({
  initialRoles,
  availablePermissions = [],
}: RolesSectionProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All')
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

  // "Deactivate" in the UI, DELETE /roles/:id underneath — the backend only
  // ever soft-deletes (sets isActive: false, see roles.service.ts's
  // remove()), so calling it "Delete" up here was labeling a reversible
  // action like a destructive one. Renamed the label and copy to say what
  // it actually does; the endpoint itself is unchanged, still a real DELETE
  // for what's still a real (if soft) removal.
  //
  // A separate standalone toggle (independent of this and Reactivate)
  // intentionally not offered: the backend already refuses the six
  // protected roles here, but a toggle would have shown for every role
  // except Business Owner — including those six — so it would have 403'd on
  // exactly the roles most likely to be toggled. Deactivate and Reactivate
  // are exact inverses of each other, so a role only ever needs one of the
  // two visible at a time.
  async function handleDeactivate(role: Role) {
    setOpenMenu(null)
    if (!confirm(`Deactivate the "${role.name}" role? This can be undone by an administrator.`)) {
      return
    }

    const result = await deleteRole(role.id)

    if (!result.success) {
      showToast({
        title: 'Failed to deactivate role',
        description: result.message || result.error,
        status: 'error',
      })
      return
    }

    showToast({
      title: 'Role deactivated',
      description: `${role.name} has been deactivated.`,
      status: 'success',
    })
    router.refresh()
  }

  async function handleReactivate(role: Role) {
    setOpenMenu(null)

    const result = await reactivateRole(role.id)

    if (!result.success) {
      showToast({
        title: 'Failed to reactivate role',
        description: result.message || result.error,
        status: 'error',
      })
      return
    }

    showToast({
      title: 'Role reactivated',
      description: `${role.name} has been reactivated.`,
      status: 'success',
    })
    router.refresh()
  }

  return (
    <>
      {/* Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'All' | 'Active' | 'Inactive')}
                className="appearance-none rounded-lg border border-zinc-200 py-2 pl-3 pr-9 text-sm text-zinc-900 outline-none transition focus:border-prominent-purple-400 focus:ring-2 focus:ring-prominent-purple-100"
              >
                <option>All</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            </div>
            <Link
              href="/settings/roles/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-prominent-purple-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-prominent-purple-800 hover:shadow"
            >
              <Plus className="h-4 w-4" />
              Add Role
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_2px_8px_-2px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/80">
              <tr>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Designation
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Job Description
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Module Access
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Permissions
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((role, index) => {
                  const isNearBottom = index >= filtered.length - 3
                  const moduleAccess = ACCESS_MODULES.map((moduleConfig) => ({
                    moduleConfig,
                    level: getAccessLevelForRole(role, moduleConfig, availablePermissions),
                  })).filter((item) => item.level !== 'none')
                  const isProtected = PROTECTED_ROLE_NAMES.has(role.name)
                  // Business Owner's permissions and active status can't be
                  // changed by anyone via the API (see roles.service.ts's
                  // assertNotFounderRole) — the other fixed roles aren't
                  // backend-protected from this yet, so only Business Owner
                  // gets these two disabled here.
                  const isFounderRole = role.name === 'Business Owner'
                  return (
                    <tr
                      key={role.id}
                      className="border-t border-zinc-100 transition-colors hover:bg-zinc-50/80"
                    >
                      <td className="px-4 py-3.5 text-[13.5px] font-semibold text-zinc-900">
                        {role.name}
                      </td>
                      <td className="max-w-xs px-4 py-3.5 text-zinc-500">
                        {role.description || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        {moduleAccess.length > 0 ? (
                          <div className="flex max-w-md flex-wrap gap-1.5">
                            {moduleAccess.map(({ moduleConfig, level }) => (
                              <span
                                key={moduleConfig.key}
                                title={`${moduleConfig.label}: ${ACCESS_LEVEL_LABELS[level]}`}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700"
                              >
                                {level === 'mixed' ? (
                                  <span className="h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-inset ring-amber-500" />
                                ) : (
                                  <span
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${getAccessDotClass(level)}`}
                                  />
                                )}
                                {moduleConfig.label}:{' '}
                                <span className="text-zinc-500">
                                  {SHORT_ACCESS_LEVEL_LABELS[level]}
                                </span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-zinc-400">No module access</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {/* Effective, wildcard-aware count — role.permissions.length is the raw
                            RolePermission row count, which reads as "1 permissions" for a role
                            holding a single crm:*:* row that actually covers 49 capabilities.
                            Same fix as countEffectivePermissions everywhere else in this editor;
                            this list just never got it. */}
                        {(() => {
                          const effectiveCount = countEffectivePermissions(
                            availablePermissions,
                            role.permissions.map((rolePermission) => rolePermission.permission)
                          )
                          return (
                            <span
                              title={
                                isFounderRole
                                  ? "Business Owner's permissions are fixed and can't be edited"
                                  : undefined
                              }
                              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${
                                isFounderRole
                                  ? 'border-zinc-200 bg-white text-zinc-500'
                                  : 'border-prominent-purple-200 bg-prominent-purple-50 text-prominent-purple-700'
                              }`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {effectiveCount} {effectiveCount === 1 ? 'permission' : 'permissions'}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-zinc-600">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              role.isActive ? 'bg-emerald-500' : 'bg-zinc-300'
                            }`}
                          />
                          {role.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
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
                                className={`absolute right-0 z-50 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-44 rounded-xl border border-zinc-200 bg-white shadow-lg ring-1 ring-black/5`}
                              >
                                {!isFounderRole && (
                                  <Link
                                    href={`/settings/roles/${role.id}`}
                                    onClick={() => setOpenMenu(null)}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-zinc-700 hover:bg-zinc-50"
                                  >
                                    <ShieldCheck className="h-4 w-4 text-prominent-purple-600" />
                                    {/* Not "Assign" — that reads as assigning the role to a
                                        user, which is what AssignRoleModal actually does over
                                        on the Users screen. This opens the permission editor,
                                        titled "Manage Role Access" as its own page. */}
                                    Manage Access
                                  </Link>
                                )}
                                {isFounderRole && (
                                  <span className="block px-3 py-2.5 text-xs text-zinc-400">
                                    Fixed — no actions available
                                  </span>
                                )}
                                {/* A role only ever needs one of these two — Deactivate sets
                                    isActive: false, Reactivate is its exact inverse, so
                                    whichever state the role is in decides which action
                                    makes sense to offer. */}
                                {role.isActive && !isProtected && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeactivate(role)}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50"
                                  >
                                    <PowerOff className="h-4 w-4" />
                                    Deactivate
                                  </button>
                                )}
                                {!role.isActive && (
                                  <button
                                    type="button"
                                    onClick={() => handleReactivate(role)}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-emerald-700 hover:bg-emerald-50"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Reactivate
                                  </button>
                                )}
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
    </>
  )
}
