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
])

function permissionKey(permission: Permission): string {
  return `${permission.module}:${permission.resource}:${permission.action}`
}

function actionMatches(action: string, actions: Set<string>): boolean {
  return actions.has(action) || Array.from(actions).some((item) => action.includes(item))
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

export function getSelectedPermissionIdsForLevel(
  availablePermissions: Permission[],
  moduleConfig: AccessModule,
  level: Exclude<AccessLevel, 'mixed'>
): string[] {
  const modulePermissions = getModulePermissions(availablePermissions, moduleConfig)

  if (level === 'none') return []
  if (level === 'view')
    return modulePermissions.filter(isReadPermission).map((permission) => permission.id)
  if (level === 'manage')
    return modulePermissions.filter(isManagePermission).map((permission) => permission.id)
  return modulePermissions.map((permission) => permission.id)
}

export function formatPermission(permission: Permission): string {
  return permission.description || permissionKey(permission)
}
