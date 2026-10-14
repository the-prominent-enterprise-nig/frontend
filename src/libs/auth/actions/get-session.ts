'use server'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { type SessionUser } from '@/src/libs/guards/permission'
import { parseSessionUser } from '@/src/libs/auth/parse-session-user'

/**
 * What the backend said about the session cookie:
 * - `authenticated`: valid, here is the user.
 * - `unauthenticated`: no cookie, or the backend rejected the token (401/403,
 *   or the user no longer exists). The only case that should send someone to
 *   the login page.
 * - `unavailable`: the backend timed out, errored (5xx) or was unreachable.
 *   The cookie says nothing about whether the user is still signed in, so this
 *   must never be treated as a logout — doing so bounced users to /login (and,
 *   with the cookie still set, straight back again) every time the API was
 *   busy.
 */
export type SessionState =
  | { status: 'authenticated'; session: SessionUser }
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; reason: string }

const SESSION_TIMEOUT_MS = 10_000
// One retry for a fast failure (a 5xx or dropped connection from a briefly
// saturated backend usually clears within a moment). A timeout is not retried:
// a second 10s wait would only double the time before the user sees anything.
const SESSION_RETRY_DELAY_MS = 400

// Everything 4xx except these means the token itself was refused.
const TRANSIENT_CLIENT_ERRORS = new Set([408, 425, 429])

type Attempt =
  | { kind: 'done'; state: SessionState }
  | { kind: 'retryable'; reason: string }
  | { kind: 'timeout'; reason: string }

async function attemptSession(apiUrl: string, authToken: string): Promise<Attempt> {
  let response: Response
  try {
    response = await fetch(`${apiUrl.replace(/\/$/, '')}/users/me`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      // Never persist this in the Next.js data cache — the cache key does not
      // include the Authorization header, so different tokens would share the
      // same cached response. React's cache() below handles per-request
      // deduplication.
      cache: 'no-store',
      signal: AbortSignal.timeout(SESSION_TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError'
    const reason = error instanceof Error ? error.message : 'Network error'
    return timedOut ? { kind: 'timeout', reason } : { kind: 'retryable', reason }
  }

  if (response.ok) {
    try {
      const raw = await response.json()
      return {
        kind: 'done',
        state: { status: 'authenticated', session: parseSessionUser(raw) },
      }
    } catch {
      return { kind: 'retryable', reason: 'Unreadable session response' }
    }
  }

  if (response.status >= 500 || TRANSIENT_CLIENT_ERRORS.has(response.status)) {
    return { kind: 'retryable', reason: `HTTP ${response.status}` }
  }

  return { kind: 'done', state: { status: 'unauthenticated' } }
}

/**
 * One backend round trip per request (React.cache), shared by every server
 * component on the page.
 */
const loadSessionState = cache(async (): Promise<SessionState> => {
  const cookieStore = await cookies()
  const authToken = cookieStore.get('authToken')?.value

  if (!authToken) {
    return { status: 'unauthenticated' }
  }

  const apiUrl = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL
  if (!apiUrl) {
    return { status: 'unavailable', reason: 'API URL is not configured' }
  }

  let attempt = await attemptSession(apiUrl, authToken)
  if (attempt.kind === 'retryable') {
    await new Promise((resolve) => setTimeout(resolve, SESSION_RETRY_DELAY_MS))
    attempt = await attemptSession(apiUrl, authToken)
  }

  if (attempt.kind === 'done') return attempt.state
  return { status: 'unavailable', reason: attempt.reason }
})

/**
 * Get the current user session.
 * Wrapped with React.cache() (via loadSessionState) so multiple server
 * components on the same page share one fetch result instead of each firing
 * their own request. Throws if there is no usable session.
 */
export const getSession = cache(async (): Promise<SessionUser> => {
  const state = await loadSessionState()

  if (state.status === 'authenticated') return state.session
  if (state.status === 'unauthenticated') {
    throw new Error('No valid authentication session')
  }
  throw new Error(`Failed to retrieve user session: ${state.reason}`)
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
 * Like getSessionOrNull, but tells "signed out" apart from "could not check".
 * Layouts use this to decide between redirecting to /login and showing a
 * retry screen.
 */
export async function getSessionState(): Promise<SessionState> {
  return loadSessionState()
}

/**
 * Returns the session or null if the auth cookie is missing, rejected, or the
 * backend is unreachable. Fine for pages that sit under a layout which already
 * ran getSessionState(); anything deciding whether to log the user out should
 * use getSessionState() instead.
 */
export async function getSessionOrNull(): Promise<SessionUser | null> {
  const state = await loadSessionState()
  return state.status === 'authenticated' ? state.session : null
}
