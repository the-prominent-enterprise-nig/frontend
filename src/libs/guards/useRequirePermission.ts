'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionOrNull } from '@/src/libs/auth/actions'
import { can, type SessionUser } from './permission'

type Status = 'checking' | 'authorized'

/**
 * Client-component equivalent of requirePermission() — several pages under
 * (dashboard)/pos are 'use client' at the page.tsx level (offline-sync
 * state, heavy interactivity), so the standard
 * `await getSessionOrNull(); if (!can(...)) redirect('/403')` server
 * pattern doesn't apply directly. getSessionOrNull is a server action, so
 * it's still callable here — this just moves the same check into an
 * effect and redirects client-side via the router instead of throwing
 * NEXT_REDIRECT synchronously. See Scenario 22 Part 5.
 *
 * Callers should render nothing (or a lightweight loading state) while
 * status is 'checking', to avoid a flash of protected content before the
 * permission check resolves:
 *
 *   const { session, status } = useRequirePermission(POS_PERMISSIONS.GIFT_CARDS_READ)
 *   if (status !== 'authorized' || !session) return null
 */
export function useRequirePermission(permission: string): {
  session: SessionUser | null
  status: Status
} {
  const router = useRouter()
  const [session, setSession] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let cancelled = false

    getSessionOrNull().then((result) => {
      if (cancelled) return
      if (!result) {
        router.replace('/login')
        return
      }
      if (!can(result, permission)) {
        router.replace('/403')
        return
      }
      setSession(result)
      setStatus('authorized')
    })

    return () => {
      cancelled = true
    }
  }, [router, permission])

  return { session, status }
}
