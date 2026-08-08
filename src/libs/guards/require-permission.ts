import { redirect } from 'next/navigation'
import { can, canAny, type SessionUser } from './permission'

/**
 * Server-component route guard: redirects to /login if there's no session,
 * or /403 if the session lacks the required permission(s). Every page under
 * (dashboard) previously hand-copied this two-line check — DRying it up
 * means every page redirects to the same place the same way, instead of
 * drifting (some pages were found redirecting to a module index page
 * instead of /403). Pass an array for "must hold at least one of these"
 * (matches a backend endpoint gated behind @RequirePermissions(a, b) OR
 * semantics) — see Scenario 22 Part 5.
 */
export function requirePermission(
  session: SessionUser | null,
  permission: string | string[]
): SessionUser {
  if (!session) redirect('/login')

  const authorized = Array.isArray(permission)
    ? canAny(session, permission)
    : can(session, permission)
  if (!authorized) redirect('/403')

  return session
}
