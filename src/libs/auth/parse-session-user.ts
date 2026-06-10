import type { SessionUser } from '@/src/libs/guards/permission'

export function parseSessionUser(raw: any): SessionUser {
  const data = raw.user ?? raw

  const roles: string[] = Array.isArray(data.userRoles)
    ? data.userRoles.map((ur: { role?: { name?: string } }) => ur.role?.name).filter(Boolean)
    : Array.isArray(data.roles)
      ? data.roles
      : []

  const permissions: string[] = Array.isArray(data.userRoles)
    ? (() => {
        const perms = new Set<string>()
        for (const ur of data.userRoles as Array<{
          role?: {
            permissions?: Array<{
              permission?: { module?: string; resource?: string; action?: string }
            }>
          }
        }>) {
          for (const rp of ur.role?.permissions ?? []) {
            const p = rp.permission
            if (p?.module && p?.resource && p?.action) {
              perms.add(`${p.module}:${p.resource}:${p.action}`)
            }
          }
        }
        return Array.from(perms)
      })()
    : Array.isArray(data.permissions)
      ? data.permissions
      : []

  const branches = Array.isArray(data.userBranches)
    ? data.userBranches
        .map((ub: { branch?: { id: string; name: string } }) => ub.branch)
        .filter(Boolean)
    : Array.isArray(data.branches)
      ? data.branches
      : []

  return {
    id: data.id,
    auth0Id: data.auth0Id,
    email: data.email,
    name: data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    fullName: data.fullName,
    isActive: data.isActive ?? true,
    status: data.status,
    isSuperAdmin: data.isSuperAdmin === true,
    enterpriseOwnerId: data.enterpriseOwnerId ?? null,
    enterpriseOwnerName: data.enterpriseOwnerName ?? null,
    enterpriseOwner: data.enterpriseOwner
      ? {
          id: data.enterpriseOwner.id,
          companyLegalName: data.enterpriseOwner.companyLegalName,
          companyTradingName: data.enterpriseOwner.companyTradingName ?? null,
          registrationNumber: data.enterpriseOwner.registrationNumber ?? null,
          taxId: data.enterpriseOwner.taxId ?? null,
          industry: data.enterpriseOwner.industry ?? null,
          country: data.enterpriseOwner.country ?? null,
          status: data.enterpriseOwner.status ?? null,
          businessSettings: data.enterpriseOwner.businessSettings ?? null,
          activeSubscription: data.enterpriseOwner.activeSubscription ?? null,
        }
      : null,
    employeeId: data.employeeId ?? undefined,
    departmentId: data.departmentId ?? null,
    positionId: data.positionId ?? null,
    branchId: data.branchId ?? null,
    managerId: data.managerId ?? null,
    employee: data.employee ?? undefined,
    branches,
    roles,
    permissions,
    primaryRole: data.primaryRole,
    hierarchyLevel: data.hierarchyLevel,
    moduleAccess: Array.isArray(data.moduleAccess) ? data.moduleAccess : undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    lastLoginAt: data.lastLoginAt ?? null,
  } satisfies SessionUser
}
