import { isExplicitOnlyPermission } from './explicit-only-permissions'
type Permission = string // e.g. "hr:attendance:update"

export interface SessionEmployee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  departmentId?: string | null
  positionId?: string | null
  branchId?: string | null
  managerId?: string | null
}

export interface SessionBranch {
  id: string
  name: string
}

export interface SessionEnterpriseOwner {
  id: string
  companyLegalName: string
  companyTradingName?: string | null
  registrationNumber?: string | null
  taxId?: string | null
  industry?: string | null
  country?: string | null
  status?: string | null
  businessSettings?: {
    enabledModules?: string[]
  } | null
  activeSubscription?: {
    planCode?: string | null
    status?: string | null
    billingCycle?: string | null
    userLimit?: number | null
    branchLimit?: number | null
    currency?: string | null
    amount?: string | number | null
    nextBillingDate?: string | null
  } | null
}

export interface SessionUser {
  id: string
  auth0Id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  fullName?: string
  isActive: boolean
  status?: string
  isSuperAdmin?: boolean
  enterpriseOwnerId?: string | null
  enterpriseOwnerName?: string | null
  enterpriseOwner?: SessionEnterpriseOwner | null
  employeeId?: string
  departmentId?: string | null
  positionId?: string | null
  branchId?: string | null
  branchName?: string | null
  managerId?: string | null
  employee?: SessionEmployee | null
  branches: SessionBranch[]
  roles: string[]
  /** The roles' own rows plus what their features bring (view or pick only,
   * Scenario 74). What actions and pages check. */
  permissions: Permission[]
  /** The roles' own rows alone. What navigation is built from, so a pick list
   * never adds a sidebar item or hub tab. Absent on older sessions. */
  rolePermissions?: Permission[]
  primaryRole?: string
  /** The home page of the highest-priority role that sets one (landing page,
   * default menu, dashboard). See libs/guards/home-module.ts. */
  homeModule?: string | null
  hierarchyLevel?: number
  moduleAccess?: string[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

/** What the permission checks read from a session. A narrower view of
 * SessionUser, so the sidebar's trimmed session type can use the same rules as
 * the pages instead of keeping its own copy. */
export type PermissionHolder = Pick<
  SessionUser,
  'roles' | 'permissions' | 'primaryRole' | 'isSuperAdmin' | 'branchId'
>

export function isSuperAdmin(user: SessionUser): boolean {
  return user.isSuperAdmin === true || user.primaryRole === 'super-admin'
}

export function hasPrivilegedRole(user: PermissionHolder): boolean {
  return hasRole(user, 'Business Owner')
}

/** Whether the user holds the named role, as their primary role or any other. */
export function hasRole(user: PermissionHolder, role: string): boolean {
  return user.primaryRole === role || user.roles.includes(role)
}

/**
 * Settings' "manage" permissions (admin:roles:manage, admin:users:manage, …)
 * stand for create, read, update and delete of their resource, the same rule
 * the backend's matchesPermission applies, so a page that lets a "manage" role
 * in and the route it calls agree. Admin module only: elsewhere "manage" is one
 * specific step (pos:collections:manage).
 */
const MANAGE_COVERS = new Set(['create', 'read', 'update', 'delete'])

export function adminManageCovers(userParts: string[], requiredParts: string[]): boolean {
  return (
    userParts.length === 3 &&
    userParts[0] === 'admin' &&
    userParts[2] === 'manage' &&
    MANAGE_COVERS.has(requiredParts[2])
  )
}

function matchesPermission(userPermission: string, requiredPermission: string): boolean {
  if (userPermission === requiredPermission) return true

  // A permission a wildcard never hands out (explicit-only-permissions.ts):
  // only the row itself, or the all-permissions row, holds it.
  if (isExplicitOnlyPermission(requiredPermission)) return userPermission === '*:*:*'

  const userParts = userPermission.split(':')
  const requiredParts = requiredPermission.split(':')
  const length = Math.max(userParts.length, requiredParts.length)

  // A user's granted permission can end in '*' to cover everything under that
  // prefix (e.g. granted 'inventory:*' matching required 'inventory:items:read')
  // — a missing trailing segment on the USER side is treated as a wildcard.
  // A shorter REQUIRED permission must NOT auto-match extra user segments —
  // otherwise checking a broad 'module:*' requirement (as the WILDCARD
  // fallback checks do) would be satisfied by any single specific
  // 'module:x:y' grant, defeating the check entirely.
  for (let index = 0; index < length; index += 1) {
    const userPart = userParts[index] ?? '*'
    const requiredPart = requiredParts[index]

    if (requiredPart === undefined) return userPart === '*'
    if (userPart === '*' || requiredPart === '*') continue
    if (userPart !== requiredPart) return index === 2 && adminManageCovers(userParts, requiredParts)
  }

  return true
}

/**
 * Scenario 85 — Sales Quotas are Business Owner only (developer decision
 * 2026-11-05). can() isn't enough: Branch Manager's 'pos:*:*' wildcard matches
 * every pos permission, so the role itself is checked. Mirrors the backend's
 * canManageQuotas().
 */
export function canManageSalesQuotas(user: SessionUser | null | undefined): boolean {
  if (!user) return false
  return Boolean(user.isSuperAdmin || hasPrivilegedRole(user))
}

export function can(user: PermissionHolder, permission: Permission): boolean {
  if (hasPrivilegedRole(user)) return true
  return user.permissions.some((p) => matchesPermission(p, permission))
}

/**
 * Whether a user's permissions reach a module. Decided by what the user's roles
 * grant and nothing else: there used to be a fixed list of modules for roles
 * named cashier, pos-manager and pos, which answered from that list alone and
 * ignored every other role the user held, so a Finance Clerk - Payables who was also a
 * Cashier was sent to /403 on Accounting. It also meant a role an owner happened
 * to name "POS" was locked to POS. Both are gone: a role name never decides
 * access.
 */
export function canAccessModule(user: SessionUser, module: string): boolean {
  if (hasPrivilegedRole(user)) return true

  if (user.moduleAccess?.includes(module)) return true
  return user.permissions.some((p) => p === `${module}:*` || p.startsWith(`${module}:`))
}

// Check multiple — user must have ALL
export function canAll(user: SessionUser, perms: Permission[]): boolean {
  return perms.every((p) => can(user, p))
}

// Check multiple — user must have AT LEAST ONE
export function canAny(user: SessionUser, perms: Permission[]): boolean {
  return perms.some((p) => can(user, p))
}

/** Navigation only (sidebar, hub tabs): the roles' own rows, without what
 * their features bring. */
export function canNavigate(user: SessionUser, permission: Permission): boolean {
  if (hasPrivilegedRole(user)) return true
  return (user.rolePermissions ?? user.permissions).some((p) => matchesPermission(p, permission))
}

export function canNavigateAny(user: SessionUser, perms: Permission[]): boolean {
  return perms.some((p) => canNavigate(user, p))
}

/** Navigation only: canAccessModule on the roles' own rows. A module the role
 * reaches only through what its features bring (CRM's customer lookups bring
 * accounting:* reads) is not one to land in — its entry page counts own rows
 * and would find nothing to open. */
export function canNavigateModule(user: SessionUser, module: string): boolean {
  return canAccessModule({ ...user, permissions: user.rolePermissions ?? user.permissions }, module)
}

// Permissions granted by the admin role
export const ADMIN_ROLE_PERMISSIONS = ['admin:roles:manage', 'admin:permissions:manage'] as const

// Check if user is an admin (assigned the admin role)
export function isAdmin(user: PermissionHolder): boolean {
  if (hasPrivilegedRole(user)) return true
  return ADMIN_ROLE_PERMISSIONS.some((p) => can(user, p))
}

/** The rows that let someone change POS-wide settings: configuration and
 * payment methods, terminals, financing terms, TPF providers, the loyalty
 * program. Branch staff no longer hold them (2026-11-05). */
export const POS_SETTINGS_PERMISSIONS = [
  'pos:config:manage',
  'pos:terminals:manage',
  'pos:financing-terms:manage',
  'pos:tpf-providers:manage',
  'pos:loyalty-program:manage',
]

/**
 * Whether the user may change POS-wide settings (GL mapping, discount/stock
 * thresholds, financing terms, etc). Decided by the permission rows the user's
 * roles hold, so a custom role with the toggle gets the Settings area and one
 * without it does not; no role name is consulted. Deliberately narrower than
 * `can(user, 'pos:*')`, which loosely matches any single pos:x:y permission a
 * Cashier also happens to hold.
 */
export function canManagePosSettings(user: PermissionHolder): boolean {
  if (isAdmin(user)) return true
  return POS_SETTINGS_PERMISSIONS.some((p) => can(user, p))
}

/**
 * A branch-assigned user who changes POS settings without being an admin: the
 * Branch Manager's position, and any custom role given the same toggle. Their
 * settings reach their own branch only ("My Branch", branch receipt branding,
 * the till's branch). The test is the permission and the branch, never a role
 * name.
 */
export function managesOwnBranch(user: PermissionHolder): boolean {
  return !isAdmin(user) && !!user.branchId && can(user, 'pos:config:manage')
}

/**
 * Whether supplier prices (unit price, line amounts, totals) show on Purchase
 * Orders and Receiving Reports — on screen and in print. Per the access
 * sheet, whoever may see receiving cost (inventory:receive:cost-view: Head
 * Office inventory roles, Department Heads, Owners); Accounting reads its own
 * RR copy through its financial-report permission. The "no item cost" roles —
 * branch staff and warehouse custodians — get quantities only.
 */
export function canSeeSupplierPrices(user: SessionUser): boolean {
  return canAny(user, ['inventory:receive:cost-view', 'accounting:financial_report:read'])
}
