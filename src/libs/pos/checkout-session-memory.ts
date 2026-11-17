/**
 * The session Checkout keeps for this login until it closes (developer,
 * 2026-11-16): picking it again on every visit was a chore.
 *
 * Checkout asks which session a sale is for only when it has none to keep:
 * the first time, or once the kept one has closed. Whatever the person picks
 * (picker or top-bar dropdown), or opens in POS → Sessions, is kept. It is
 * never a guess: it is always a session this person chose, and Checkout
 * only uses it while it is still open and listed.
 *
 * Kept per login, so on a shared till the next person to sign in does not
 * start on the previous person's session. Separate from the checkout handoff
 * (checkout-handoff.ts), which carries a sale.
 */
const CHECKOUT_SESSION_KEY = 'pos_checkout_session'

type Kept = { userId: string; sessionId: string }

/** Never throws: localStorage can be unavailable (private windows, blocked
 * site data), and Checkout then simply asks as before. */
export function keepCheckoutSession(userId: string, sessionId: string): void {
  try {
    localStorage.setItem(CHECKOUT_SESSION_KEY, JSON.stringify({ userId, sessionId } satisfies Kept))
  } catch {
    /* not kept; Checkout asks next time */
  }
}

/** Whatever is kept, for whichever login. Checkout reads it before it knows
 * who is signed in, to wait rather than flash the picker when a session is
 * about to be restored. */
export function readKeptCheckoutSession(): Kept | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_SESSION_KEY)
    if (!raw) return null
    const kept = JSON.parse(raw) as Partial<Kept>
    return typeof kept.userId === 'string' && typeof kept.sessionId === 'string'
      ? { userId: kept.userId, sessionId: kept.sessionId }
      : null
  } catch {
    return null
  }
}

/** The session kept for this login, if any. Whether it is still open is
 * Checkout's to check against its own list. */
export function keptCheckoutSession(userId: string): string | null {
  const kept = readKeptCheckoutSession()
  return kept?.userId === userId ? kept.sessionId : null
}
