'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { type SessionUser } from '@/src/libs/guards/permission'
import { parseSessionUser } from '@/src/libs/auth/parse-session-user'

/**
 * Get the current user session.
 * Wrapped with React.cache() so multiple server components on the same page
 * share one fetch result instead of each firing their own request.
 */
export const getSession = cache(async (): Promise<SessionUser> => {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  if (!authToken) {
    throw new Error('No authentication token found')
  }

  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    throw new Error('API URL is not configured')
  }

  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/users/me`, {
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    // Never persist this in the Next.js data cache — the cache key does not
    // include the Authorization header, so different tokens would share the
    // same cached response. React's cache() above handles per-request
    // deduplication; freshness is handled by the 60-second authToken reissue.
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`
      Failed to retrieve user session: ${response.status} ${response.statusText} — ${body}`)
  }

  const raw = await response.json()
  return parseSessionUser(raw)
})

/**
 * Check if a user is authenticated (has a valid session).
 */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value
  return !!authToken
}

/**
 * Returns the session or null if the auth cookie is missing or the backend
 * is unreachable. Callers redirect to /login on null — a backend that is
 * temporarily down should not produce an error page for the user.
 */
export async function getSessionOrNull(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  if (!authToken) {
    return null
  }

  try {
    return await getSession()
  } catch {
    return null
  }
}
