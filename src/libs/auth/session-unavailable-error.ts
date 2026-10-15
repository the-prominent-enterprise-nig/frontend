/**
 * The backend could not be asked whether the user is signed in (it timed out,
 * answered 5xx, or was unreachable).
 *
 * This is NOT a sign-out. The cookie is untouched and the user is very likely
 * still signed in, so it must never end in a redirect to /login — it belongs to
 * the nearest error boundary, whose retry button asks again.
 *
 * Lives outside get-session.ts because a 'use server' file may only export
 * async functions.
 */
export class SessionUnavailableError extends Error {
  readonly code = 'SESSION_UNAVAILABLE'

  constructor(readonly reason: string) {
    super(`Session unavailable: ${reason}`)
    this.name = 'SessionUnavailableError'
  }
}
