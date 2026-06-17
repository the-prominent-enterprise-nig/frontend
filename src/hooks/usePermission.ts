interface SessionUser {
  id: string
  roles: string[]
  permissions: string[]
  primaryRole?: string
  moduleAccess?: string[]
}

// Roles that have a fixed module allowlist. Keep in sync with ROLE_MODULE_ACCESS in
// src/libs/guards/permission.ts — both must agree on which modules each role can reach.
const ROLE_MODULE_ACCESS: Record<string, string[]> = {
  cashier: ['pos'],
  'pos-manager': ['pos'],
}

/**
 * Check if a permission pattern matches a user permission.
 * Supports wildcards (*) for flexible permission matching.
 *
 * Examples:
 * - 'hr:*' matches 'hr:read', 'hr:write', etc.
 * - 'hr:attendance:*' matches 'hr:attendance:read', 'hr:attendance:write'
 * - 'hr:attendance:read' matches exactly 'hr:attendance:read'
 *
 * @param userPermission - The permission string from the user's session
 * @param requiredPermission - The permission being checked
 * @returns true if the user permission matches the required permission
 */
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

/**
 * Check if a user has a specific permission.
 * This is a utility function that can be used on both server and client.
 *
 * @param session - The user session object
 * @param permission - The permission string to check (e.g., 'hr:attendance:read')
 * @returns true if user has the permission, false otherwise
 */
export function hasPermission(session: SessionUser | null, permission: string): boolean {
  if (!session) return false
  if (session.primaryRole === 'Business Owner' || session.roles.includes('Business Owner')) {
    return true
  }
  return session.permissions.some((p) => matchesPermission(p, permission))
}

/**
 * Hook to check if the current user has a specific permission.
 * Requires session to be passed from server component.
 *
 * @param session - The user session from server
 * @param permission - The permission string to check (e.g., 'hr:attendance:read')
 * @returns true if user has the permission, false otherwise
 *
 * @example
 * ```tsx
 * // In server component:
 * const session = await getSession()
 *
 * // Pass to client component:
 * function MyComponent({ session }) {
 *   const canEdit = usePermission(session, 'hr:attendance:write')
 *
 *   return canEdit ? <EditButton /> : <ViewOnlyMessage />
 * }
 * ```
 */
export function usePermission(session: SessionUser | null, permission: string): boolean {
  return hasPermission(session, permission)
}

/**
 * Check if a user can see a top-level module tab.
 * For roles with an explicit allowlist (e.g. cashier → pos only), the allowlist
 * takes precedence so they cannot see other modules even if they happen to hold
 * stray permissions for them.
 */
export function hasModuleAccess(session: SessionUser | null, moduleKey: string): boolean {
  if (!session) return false
  if (
    session.primaryRole === 'Business Owner' ||
    session.roles.includes('Business Owner') ||
    session.primaryRole === 'branch-manager' ||
    session.roles.includes('branch-manager')
  )
    return true

  // Collect all role identifiers (primaryRole + roles[]), normalised to lowercase
  // so backend casing variations like "Cashier" still match.
  const allRoles = [...(session.primaryRole ? [session.primaryRole] : []), ...session.roles].map(
    (r) => r.toLowerCase()
  )

  const restrictedRoles = allRoles.filter((r) => r in ROLE_MODULE_ACCESS)
  if (restrictedRoles.length > 0) {
    return restrictedRoles.some((r) => ROLE_MODULE_ACCESS[r]?.includes(moduleKey))
  }

  // Trust the backend-computed moduleAccess list when present — it correctly handles
  // cross-module permission mappings (e.g. hr:payslips:read → payroll nav tab).
  if (session.moduleAccess) {
    return session.moduleAccess.includes(moduleKey)
  }

  return session.permissions.some((p) => p === `${moduleKey}:*` || p.startsWith(`${moduleKey}:`))
}
