'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionStateWithRetry } from '@/src/libs/auth/session-client'
import { SessionUnavailableError } from '@/src/libs/auth/session-unavailable-error'
import { can, canAny, type SessionUser } from './permission'

type Status = 'checking' | 'authorized'

/**
 * Client-component equivalent of requirePermission() — several pages under
 * (dashboard)/pos are 'use client' at the page.tsx level (offline-sync
 * state, heavy interactivity), so the standard
 * `await getSessionOrNull(); if (!can(...)) redirect('/403')` server
 * pattern doesn't apply directly. getSessionState is a server action, so
 * it's still callable here — this just moves the same check into an
 * effect and redirects client-side via the router instead of throwing
 * NEXT_REDIRECT synchronously. See Scenario 22 Part 5.
 *
 * Only a session the backend rejected sends the user to /login. If the backend
 * could not be asked (busy, timing out) the check is retried a couple of times,
 * and if it still cannot be answered the hook throws SessionUnavailableError
 * into the nearest error boundary, whose "Try again" remounts the page and
 * re-runs this check. Callers need no change: they already render nothing while
 * status is 'checking'.
 *
 * Callers should render nothing (or a lightweight loading state) while
 * status is 'checking', to avoid a flash of protected content before the
 * permission check resolves:
 *
 *   const { session, status } = useRequirePermission(POS_PERMISSIONS.GIFT_CARDS_READ)
 *   if (status !== 'authorized' || !session) return null
 *
 * A list means any one of them, as with requirePermission().
 */
export function useRequirePermission(permission: string | string[]): {
  session: SessionUser | null
  status: Status
} {
  // A list passed inline is a new array every render; key the effect on its
  // contents so it doesn't re-run each time.
  const permissionKey = Array.isArray(permission) ? permission.join('|') : permission
  const router = useRouter()
  const [session, setSession] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<Status>('checking')
  const [unavailable, setUnavailable] = useState<SessionUnavailableError | null>(null)

  useEffect(() => {
    let cancelled = false

    getSessionStateWithRetry(() => cancelled).then((state) => {
      if (cancelled) return
      if (state.status === 'unauthenticated') {
        router.replace('/login')
        return
      }
      if (state.status === 'unavailable') {
        setUnavailable(new SessionUnavailableError(state.reason))
        return
      }
      const permissions = permissionKey.split('|')
      const allowed =
        permissions.length > 1
          ? canAny(state.session, permissions)
          : can(state.session, permissionKey)
      if (!allowed) {
        router.replace('/403')
        return
      }
      setSession(state.session)
      setStatus('authorized')
    })

    return () => {
      cancelled = true
    }
  }, [router, permissionKey])

  if (unavailable) throw unavailable

  return { session, status }
}
