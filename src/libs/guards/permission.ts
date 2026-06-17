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
  managerId?: string | null
  employee?: SessionEmployee | null
  branches: SessionBranch[]
  roles: string[]
  permissions: Permission[]
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

function matchesPermission(userPermission: string, requiredPermission: string): boolean {
  if (userPermission === requiredPermission) return true

  const userParts = userPermission.split(':')
  const requiredParts = requiredPermission.split(':')
  const length = Math.max(userParts.length, requiredParts.length)

  for (let index = 0; index < length; index += 1) {
    const userPart = userParts[index] ?? '*'
    const requiredPart = requiredParts[index] ?? '*'

    if (userPart === '*' || requiredPart === '*') continue
    if (userPart !== requiredPart) return false
  }

  return true
}

export function can(user: SessionUser, permission: Permission): boolean {
  if (hasPrivilegedRole(user)) return true
  return user.permissions.some((p) => matchesPermission(p, permission))
}

const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  cashier: ['pos'],
  'pos-manager': ['pos'],
}

export function canAccessModule(user: SessionUser, module: string): boolean {
  if (hasPrivilegedRole(user)) return true
  if (user.primaryRole === 'branch-manager' || user.roles.includes('branch-manager')) return true
  if (user.moduleAccess?.includes(module)) return true

  const allRoles = [...(user.primaryRole ? [user.primaryRole] : []), ...user.roles].map((r) =>
    r.toLowerCase()
  )

  const restrictedRoles = allRoles.filter((r) => r in ROLE_MODULE_ACCESS)
  if (restrictedRoles.length > 0) {
    return restrictedRoles.some((r) => ROLE_MODULE_ACCESS[r]?.includes(module))
  }

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

// Permissions granted by the admin role
const ADMIN_ROLE_PERMISSIONS = ['admin:roles:manage', 'admin:permissions:manage'] as const

// Check if user is an admin (assigned the admin role)
export function isAdmin(user: SessionUser): boolean {
  if (hasPrivilegedRole(user)) return true
  return ADMIN_ROLE_PERMISSIONS.some((p) => can(user, p))
}
