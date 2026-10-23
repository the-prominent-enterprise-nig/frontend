import { getSessionState, type SessionState } from '@/src/libs/auth/actions'

// A busy backend usually answers again within a couple of seconds. getSessionState
// already retries one fast failure server-side; these are the client's own tries
// on top of that before it gives up and hands the problem to an error boundary.
const RETRY_DELAYS_MS = [600, 1_800]

async function readState(): Promise<SessionState> {
  try {
    return await getSessionState()
  } catch (error) {
    // The Next.js server itself could not be reached — also "could not check",
    // never "signed out".
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Client-side session check that tells "signed out" apart from "could not
 * check", retrying the latter a couple of times. Use this instead of
 * `getSessionOrNull()` in any client component that would otherwise treat
 * `null` as a reason to redirect to /login.
 */
export async function getSessionStateWithRetry(
  isCancelled: () => boolean = () => false
): Promise<SessionState> {
  let state = await readState()
  for (const delay of RETRY_DELAYS_MS) {
    if (state.status !== 'unavailable' || isCancelled()) break
    await new Promise((resolve) => setTimeout(resolve, delay))
    if (isCancelled()) break
    state = await readState()
  }
  return state
}
