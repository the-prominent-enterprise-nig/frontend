import { type Permission, type Role } from '@/src/schema/settings/list'

export type AccessLevel = 'none' | 'view' | 'manage' | 'full' | 'mixed'

/** The 4 levels an admin can actually set via a module toggle button. 'mixed' is a derived description of the current state, never a target to click. */
export const SETTABLE_ACCESS_LEVELS: readonly Exclude<AccessLevel, 'mixed'>[] = [
  'none',
  'view',
  'manage',
  'full',
]

export type AccessModule = {
  key: string
  label: string
  permissionModules: string[]
}

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  none: 'No Access',
  view: 'View Only',
  manage: 'Manage / Edit',
  full: 'Full Access',
  mixed: 'Mixed Access',
}

// Scenario 22 Part 9 follow-up: no separate 'procurement' entry — Purchase
// Requests/Orders/Suppliers/Quotas permissions were folded into the
// 'inventory' module (they already lived under the Inventory nav section;
// the RBAC module just hadn't caught up). Their capabilities now report
// under Inventory's own "N of N" count and Full/Mixed/View badge below.
export const ACCESS_MODULES: AccessModule[] = [
  { key: 'accounting', label: 'Accounting', permissionModules: ['accounting'] },
  { key: 'inventory', label: 'Inventory', permissionModules: ['inventory'] },
  { key: 'pos', label: 'Point of Sale', permissionModules: ['pos'] },
  { key: 'crm', label: 'CRM', permissionModules: ['crm'] },
  { key: 'admin', label: 'Admin', permissionModules: ['admin'] },
  { key: 'queue', label: 'Queue', permissionModules: ['queue'] },
  { key: 'sales', label: 'Sales', permissionModules: ['sales'] },
  { key: 'files', label: 'Files', permissionModules: ['files'] },
]

const READ_ACTIONS = new Set([
  'read',
  'view',
  'list',
  'search',
  'export',
  'download',
  'valuation',
  'turnover',
])

const EDIT_ACTIONS = new Set([
  'create',
  'update',
  'upload',
  'edit',
  'open',
  'close',
  'send',
  'receive',
  'dispatch',
  'issue',
  'call',
  'serve',
  'return',
  'run',
  'log',
  'request',
  'generate',
  // Requesting a reservation cancellation is an operational step, not the
  // destructive `cancel-approve` that follows it. Named explicitly because it
  // used to qualify only by accident, through the substring match below.
  'cancel-request',
])

function permissionKey(permission: Permission): string {
  return `${permission.module}:${permission.resource}:${permission.action}`
}

/**
 * Permissions the View Only and Manage / Edit presets never hand out, even when
 * the action name qualifies. They stay fully grantable — an admin just has to
 * tick them deliberately under Advanced permissions instead of picking them up
 * as an invisible side effect of a module-wide button.
 *
 * Two groups:
 *   - Enterprise-wide financial infrastructure and sensitive cost data. seed.ts
 *     already withholds this cluster from Branch Manager by hand ("deliberately
 *     excluded, not an oversight"); the presets were handing it to anyone set to
 *     Manage / Edit on Accounting regardless.
 *   - RBAC self-administration. `admin:roles:create` plus `admin:roles:update`
 *     let a role mint a new role and grant it anything, so Manage / Edit on
 *     Admin was a one-hop path to full access. Granting user administration
 *     must not imply granting permission administration.
 *
 * Full Access still includes all of these: that button says what it does.
 */
export const PRESET_EXCLUDED_PERMISSIONS = new Set([
  'accounting:fiscal:create',
  'accounting:fiscal:update',
  'accounting:fiscal:close',
  'accounting:fiscal:reopen',
  'accounting:fiscal:delete',
  'accounting:generalLedger:create',
  'accounting:generalLedger:update',
  'accounting:generalLedger:delete',
  'accounting:account:create',
  'accounting:account:update',
  'accounting:account:delete',
  'accounting:bir_export:generate',
  'inventory:receive:cost-view',
  'admin:roles:create',
  'admin:roles:update',
  'admin:roles:delete',
  'admin:roles:manage',
  'admin:permissions:create',
  'admin:permissions:update',
  'admin:permissions:delete',
  'admin:permissions:manage',
])

export function isPresetExcluded(permission: Permission): boolean {
  return PRESET_EXCLUDED_PERMISSIONS.has(permissionKey(permission))
}

/**
 * Exact membership only. This used to substring-match as well, which quietly
 * mis-tiered any action whose name happened to contain a shorter one:
 * `cost-view` counted as a read, leaking `inventory:receive:cost-view`
 * ("restricted to Business Owner/Accountant" per seed.ts) into every View Only
 * grant, and `reopen` counted as an edit, leaking `accounting:fiscal:reopen`
 * into every Manage / Edit grant. Action names are a closed set defined in
 * seed.ts — anything genuinely operational belongs in the sets above by name,
 * not by an accident of spelling.
 */
function actionMatches(action: string, actions: Set<string>): boolean {
  return actions.has(action)
}

export function getModulePermissions(
  permissions: Permission[],
  moduleConfig: AccessModule
): Permission[] {
  return permissions.filter((permission) =>
    moduleConfig.permissionModules.includes(permission.module)
  )
}

export function isReadPermission(permission: Permission): boolean {
  return actionMatches(permission.action, READ_ACTIONS)
}

export function isManagePermission(permission: Permission): boolean {
  return (
    actionMatches(permission.action, READ_ACTIONS) || actionMatches(permission.action, EDIT_ACTIONS)
  )
}

function groupByResource(permissions: Permission[]): Map<string, Permission[]> {
  const byResource = new Map<string, Permission[]>()
  for (const permission of permissions) {
    const group = byResource.get(permission.resource) ?? []
    group.push(permission)
    byResource.set(permission.resource, group)
  }
  return byResource
}

/**
 * "Full" means the role holds every permission that exists for this
 * resource — not "has some action from a hardcoded FULL_ACTIONS list".
 * Some resources structurally never have a delete/approve/void-style
 * action at all (their whole available set might just be read+create), so
 * matching against FULL_ACTIONS made even Business Owner — who holds every
 * permission there is — show as merely "manage" (or worse, "mixed") on
 * those resources purely because no permission existed to satisfy the
 * action-name check. Comparing selected count against the resource's own
 * available count sidesteps that: 100% coverage is unambiguously "full"
 * regardless of what actions happen to exist for that resource.
 */
function getResourceLevel(
  selectedForResource: Permission[],
  availableForResource: Permission[]
): Exclude<AccessLevel, 'mixed'> {
  if (selectedForResource.length === 0) return 'none'
  if (selectedForResource.length >= availableForResource.length) return 'full'
  if (selectedForResource.some((permission) => actionMatches(permission.action, EDIT_ACTIONS)))
    return 'manage'
  return 'view'
}

/**
 * A module spans many distinct resources (e.g. accounting has journalEntry,
 * ar-invoices, budget, customer-advances, ...). OR-ing their actions
 * together — the old behavior — meant one unrelated create permission on a
 * minor resource (e.g. customer-advances:create) flipped the WHOLE
 * module's level to "Manage / Edit", even though every other resource in
 * it stayed strictly read-only. Grouping by resource first and only
 * calling it uniform when every GRANTED resource agrees catches that drift
 * ('mixed') instead of silently overstating access. A resource the role
 * has zero permissions for doesn't count against uniformity — that's just
 * "not granted," not a conflict — only resources with >=1 permission
 * selected are compared. See Scenario 22 Part 10.
 *
 * `availableModulePermissions` — every permission that exists for this
 * module (not just the ones this role holds) — is required to tell "has
 * everything this resource offers" (full) apart from "has some create/
 * update action but not everything" (manage). Without it, a role holding
 * literally 100% of every permission in the system would still show
 * "mixed" whenever two resources happened to cap out with different
 * action-name shapes.
 */
export function getAccessLevelForPermissions(
  selectedPermissions: Permission[],
  availableModulePermissions: Permission[]
): AccessLevel {
  if (selectedPermissions.length === 0) return 'none'

  // A grant that is exactly what a preset produces IS that preset. Without
  // this, withholding sensitive permissions from View Only / Manage / Edit (see
  // PRESET_EXCLUDED_PERMISSIONS) leaves the withheld resources sitting at a
  // different level from the rest of their module — so clicking "Manage / Edit"
  // would immediately render as "Mixed Access". True under the resource
  // heuristic below, but useless as feedback on a button just pressed.
  const selectedIds = new Set(selectedPermissions.map((permission) => permission.id))
  for (const level of SETTABLE_ACCESS_LEVELS) {
    const presetIds = getPermissionsForLevel(availableModulePermissions, level).map(
      (permission) => permission.id
    )
    if (presetIds.length !== selectedIds.size) continue
    if (presetIds.every((id) => selectedIds.has(id))) return level
  }

  const availableByResource = groupByResource(availableModulePermissions)
  const selectedByResource = groupByResource(selectedPermissions)

  const levels = new Set(
    Array.from(selectedByResource.entries(), ([resource, selectedForResource]) =>
      getResourceLevel(
        selectedForResource,
        availableByResource.get(resource) ?? selectedForResource
      )
    )
  )
  if (levels.size > 1) return 'mixed'
  return levels.values().next().value ?? 'none'
}

/**
 * "X of Y capabilities enabled" needs to count what a role can actually DO,
 * not how many RolePermission rows it holds. A role granted the single
 * `crm:*:*` wildcard row holds exactly 1 row but can do all 48 things in
 * the module — showing "1 of 48" next to a "Full Access" badge is a
 * flatly contradictory caption. Counts every available permission that the
 * selected set covers, either exactly or via a wildcard resource/action.
 */
export function countEffectivePermissions(
  availableModulePermissions: Permission[],
  selectedModulePermissions: Permission[]
): number {
  return availableModulePermissions.filter((permission) =>
    selectedModulePermissions.some(
      (selected) =>
        selected.module === permission.module &&
        (selected.resource === '*' || selected.resource === permission.resource) &&
        (selected.action === '*' || selected.action === permission.action)
    )
  ).length
}

export function getAccessLevelForRole(
  role: Role,
  moduleConfig: AccessModule,
  availablePermissions: Permission[]
): AccessLevel {
  const selected = role.permissions
    .map((rolePermission) => rolePermission.permission)
    .filter((permission) => moduleConfig.permissionModules.includes(permission.module))

  return getAccessLevelForPermissions(
    selected,
    getModulePermissions(availablePermissions, moduleConfig)
  )
}

/**
 * What one preset grants for a set of permissions — a whole module, or just
 * one resource of it (applyResourceLevel passes a single resource). Split out of
 * getSelectedPermissionIdsForLevel so getAccessLevelForPermissions can
 * recognise its own output and report the preset back by name.
 */
export function getPermissionsForLevel(
  modulePermissions: Permission[],
  level: Exclude<AccessLevel, 'mixed'>
): Permission[] {
  if (level === 'none') return []
  if (level === 'full') return modulePermissions

  const predicate = level === 'view' ? isReadPermission : isManagePermission
  return modulePermissions.filter(
    (permission) => predicate(permission) && !isPresetExcluded(permission)
  )
}

export function getSelectedPermissionIdsForLevel(
  availablePermissions: Permission[],
  moduleConfig: AccessModule,
  level: Exclude<AccessLevel, 'mixed'>
): string[] {
  const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)
  return getPermissionsForLevel(modulePermissions, level).map((permission) => permission.id)
}

export function formatPermission(permission: Permission): string {
  return permission.description || permissionKey(permission)
}

/** One resource inside a module, with the level the current selection puts it at. */
export type ResourceRow = {
  resource: string
  /** Every permission that exists for this resource. */
  permissions: Permission[]
  /** The subset currently granted. */
  selectedPermissions: Permission[]
  level: Exclude<AccessLevel, 'mixed'>
  /** Wildcard-expanded count, for the "n of m" caption. */
  effectiveCount: number
}

/**
 * The per-resource breakdown of a module, already levelled.
 *
 * getResourceLevel has always computed these — it is how "Mixed" is detected —
 * but the result was collapsed into a single badge and thrown away. Surfacing
 * the rows is what lets the editor offer a control per resource, so a role can
 * be given read on one resource of a module without read on the other 29.
 */
export function getResourceRows(
  modulePermissions: Permission[],
  selectedIds: Set<string>
): ResourceRow[] {
  return Array.from(groupByResource(modulePermissions).entries())
    .map(([resource, permissions]) => {
      const selectedPermissions = permissions.filter((permission) => selectedIds.has(permission.id))
      return {
        resource,
        permissions,
        selectedPermissions,
        level: getResourceLevel(selectedPermissions, permissions),
        effectiveCount: countEffectivePermissions(permissions, selectedPermissions),
      }
    })
    .sort((a, b) => {
      // The module-wide wildcard row ('*') is not a real resource — park it last.
      if ((a.resource === '*') !== (b.resource === '*')) return a.resource === '*' ? 1 : -1
      return formatResourceLabel(a.resource).localeCompare(formatResourceLabel(b.resource))
    })
}

/**
 * Resource slugs arrive in two shapes from seed.ts — kebab (`ap-bills`) and
 * camel (`journalEntry`) — so both are normalised before title-casing.
 */
export function formatResourceLabel(resource: string): string {
  if (resource === '*') return 'All capabilities (wildcard)'
  return resource
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Swap one resource to `level`, leaving the rest of the selection untouched.
 * Returns a new Set so callers can hand it straight to setState.
 */
export function applyResourceLevel(
  selected: Set<string>,
  resourcePermissions: Permission[],
  level: Exclude<AccessLevel, 'mixed'>
): Set<string> {
  const next = new Set(selected)
  for (const permission of resourcePermissions) next.delete(permission.id)
  for (const permission of getPermissionsForLevel(resourcePermissions, level))
    next.add(permission.id)
  return next
}
