/**
 * The single handoff record for a POS sale being carried across a
 * navigation ON PURPOSE.
 *
 * Only three things write one: resuming from Parked Sales, the
 * credit-application detour (which needs the cart's exact items), and
 * "New Customer" clearing the till after parking. Checkout reads it once on
 * arrival and deletes it.
 *
 * It is deliberately NOT a general persistence layer. An earlier version
 * also auto-parked on any navigation and stashed on pagehide, so a cart
 * could reappear without the cashier asking — that overlapped with the
 * ?customerId= return and the parked row, and the three of them racing
 * produced three separate lost-customer bugs. Removed 2026-09-19 at the
 * client's request: wandering off the till now loses the cart, and anything
 * that survives does so because someone pressed a button.
 *
 * One key, one shape, one reader. Anything needing to carry a sale goes
 * through here rather than reaching for localStorage directly.
 */
export const CHECKOUT_HANDOFF_KEY = 'pos_resumed_cart'

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
