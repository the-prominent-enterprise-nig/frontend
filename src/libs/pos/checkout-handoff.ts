/**
 * The single handoff record for an in-progress POS sale.
 *
 * Checkout's cart is plain React state, so every route change away from the
 * till has to hand it somewhere. Three mechanisms grew up doing that
 * separately — this localStorage stash, a `?customerId=` query string from
 * the create-customer form, and a server-side parked sale — and each one
 * had its own idea of who owned the customer. They raced: the stash
 * restored its customer asynchronously and could overwrite the newly
 * created one that the query string had just attached.
 *
 * So: one record, one key, one shape, one reader. Anything that needs to
 * carry a sale across a navigation goes through here rather than reaching
 * for localStorage directly. The query string is still the transport for a
 * just-created customer (it survives a fresh tab, which localStorage
 * handoffs deliberately do not), but checkout now resolves BOTH sources in
 * one place with an explicit precedence instead of two effects fighting.
 */
export const CHECKOUT_HANDOFF_KEY = 'pos_resumed_cart'

/** Set when the auto-park teardown has consumed a stash before its parked
 * row was written — see checkout's teardown for why the nonce exists. */
export const AUTO_PARK_CONSUMED_KEY = 'pos_autopark_consumed'

/** Generic over the cart-line type: CartLine is declared inside the
 * checkout page, and this module deliberately sits below it so both the
 * till and the parked-sales page can depend on it without a cycle. */
export type CheckoutHandoff<TLine = unknown> = {
  lines?: TLine[]
  customerId?: string
  promoCodeId?: string
  /** The POS session this sale was being rung up under. Checkout discards a
   * handoff whose session is no longer open, so a new shift never inherits
   * the previous cashier's cart off the back of a stash nobody consumed
   * (2026-09-19). A genuinely abandoned sale still exists server-side as a
   * parked sale, which is the durable copy and is branch-visible. */
  sessionId?: string
  /** Ties a stash to the parked row scheduled alongside it, so returning to
   * checkout can close that row out instead of leaving the Parked Sales
   * list showing a sale already back on screen. */
  autoParkNonce?: string
  /** Filled in once the parked row actually exists. */
  autoParkedId?: string
}

/** Never throws: localStorage can be unavailable (private windows, blocked
 * site data) and a half-written value must not take the till down. */
export function readCheckoutHandoff<TLine = unknown>(): CheckoutHandoff<TLine> | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_HANDOFF_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CheckoutHandoff<TLine>
  } catch {
    return null
  }
}

export function writeCheckoutHandoff<TLine = unknown>(handoff: CheckoutHandoff<TLine>): boolean {
  try {
    localStorage.setItem(CHECKOUT_HANDOFF_KEY, JSON.stringify(handoff))
    return true
  } catch {
    return false
  }
}

export function clearCheckoutHandoff(): void {
  try {
    localStorage.removeItem(CHECKOUT_HANDOFF_KEY)
  } catch {
    /* nothing to clear */
  }
}
