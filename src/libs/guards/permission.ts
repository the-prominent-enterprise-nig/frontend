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
  hierarchyLevel?: number
  moduleAccess?: string[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string | null
}

export function isSuperAdmin(user: SessionUser): boolean {
  return user.isSuperAdmin === true || user.primaryRole === 'super-admin'
}

export function hasPrivilegedRole(user: SessionUser): boolean {
  return user.primaryRole === 'Business Owner' || user.roles.includes('Business Owner')
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

export function can(user: SessionUser, permission: Permission): boolean {
  if (hasPrivilegedRole(user)) return true
  return user.permissions.some((p) => matchesPermission(p, permission))
}

const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  // Cashier is not here: the client's Access Levels sheet gives the Branch
  // Cashier Expenses, CRM and Stock Transaction as well as POS, so the
  // Cashier's modules come from its permissions like any other role's. It
  // replaces the POS-only entry from the 2026-09-19 review request.
  'pos-manager': ['pos'],
  pos: ['pos'],
}

/**
 * The fixed allowlists' answer for `module`, or null when the permissions
 * decide. A list decides only when every one of the user's roles has one, so
 * stray permissions on those roles don't open other modules. A user who also
 * holds a role without a list gets that role's modules from its permissions:
 * one role's list never takes away what another role gives (UAT review
 * 2026-11-04, a Payables Clerk who is also a Cashier).
 */
export function fixedModuleAccess(roles: string[], module: string): boolean | null {
  const names = roles.map((r) => r.toLowerCase())
  if (names.length === 0 || names.some((r) => !(r in ROLE_MODULE_ACCESS))) return null
  return names.some((r) => ROLE_MODULE_ACCESS[r].includes(module))
}

export function canAccessModule(user: SessionUser, module: string): boolean {
  if (hasPrivilegedRole(user)) return true

  const fixed = fixedModuleAccess(
    [...(user.primaryRole ? [user.primaryRole] : []), ...user.roles],
    module
  )
  if (fixed !== null) return fixed

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
const ADMIN_ROLE_PERMISSIONS = ['admin:roles:manage', 'admin:permissions:manage'] as const

// Check if user is an admin (assigned the admin role)
export function isAdmin(user: SessionUser): boolean {
  if (hasPrivilegedRole(user)) return true
  return ADMIN_ROLE_PERMISSIONS.some((p) => can(user, p))
}

/**
 * Business Owner or Branch Manager only — the two roles allowed to configure
 * POS-wide settings (GL mapping, discount/stock thresholds, financing terms,
 * etc). Deliberately narrower than `can(user, 'pos:*')`, which loosely
 * matches any single pos:x:y permission a Cashier also happens to hold.
 */
export function canManagePosSettings(user: SessionUser): boolean {
  if (isAdmin(user)) return true
  const allRoles = [user.primaryRole ?? '', ...user.roles]
  return allRoles.some((r) => r === 'Branch Manager' || r === 'pos-manager')
}
