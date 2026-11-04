import { adminManageCovers, fixedModuleAccess } from '@/src/libs/guards/permission'

interface SessionUser {
  id: string
  roles: string[]
  permissions: string[]
  /** The roles' own rows, without what their features bring (Scenario 74). */
  rolePermissions?: string[]
  primaryRole?: string
  moduleAccess?: string[]
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

  // A user's granted permission can end in '*' to cover everything under that
  // prefix (e.g. granted 'inventory:*' matching required 'inventory:items:read')
  // — a missing trailing segment on the USER side is treated as a wildcard.
  // A shorter REQUIRED permission must NOT auto-match extra user segments —
  // otherwise checking a broad 'module:*' requirement would be satisfied by
  // any single specific 'module:x:y' grant, defeating the check entirely.
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
 * Check if a user has a specific permission.
 * This is a utility function that can be used on both server and client.
 *
 * @param session - The user session object
 * @param permission - The permission string to check (e.g., 'hr:attendance:read')
 * @returns true if user has the permission, false otherwise
 */
/**
 * The permission row itself — no wildcard match and no Business Owner
 * shortcut. For the few screens a wildcard grant must not reach (Scenario 62:
 * the Data Query Center, where the Accountant's 'accounting:*' would
 * otherwise qualify). Mirrors the backend's QueryCenterGuard.
 */
export function hasExactPermission(session: SessionUser | null, permission: string): boolean {
  return !!session?.permissions.includes(permission)
}

/** Navigation only (sidebar): the roles' own rows, without what their
 * features bring, so a pick list never adds a sidebar item (Scenario 74). */
export function hasNavPermission(session: SessionUser | null, permission: string): boolean {
  if (!session) return false
  if (session.primaryRole === 'Business Owner' || session.roles.includes('Business Owner')) {
    return true
  }
  return (session.rolePermissions ?? session.permissions).some((p) =>
    matchesPermission(p, permission)
  )
}

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
 * When every one of the user's roles has an explicit allowlist (pos → pos
 * only), the allowlist decides, so stray permissions don't open other modules.
 * Otherwise the user's permissions do.
 */
export function hasModuleAccess(session: SessionUser | null, moduleKey: string): boolean {
  if (!session) return false
  if (session.primaryRole === 'Business Owner' || session.roles.includes('Business Owner'))
    return true

  // The same allowlists the page guard uses (src/libs/guards/permission.ts),
  // so the sidebar and the guard can't disagree.
  const fixed = fixedModuleAccess(
    [...(session.primaryRole ? [session.primaryRole] : []), ...session.roles],
    moduleKey
  )
  if (fixed !== null) return fixed

  // Trust the backend-computed moduleAccess list when present — it correctly handles
  // cross-module permission mappings (e.g. hr:payslips:read → payroll nav tab).
  if (session.moduleAccess) {
    return session.moduleAccess.includes(moduleKey)
  }

  return session.permissions.some((p) => p === `${moduleKey}:*` || p.startsWith(`${moduleKey}:`))
}
