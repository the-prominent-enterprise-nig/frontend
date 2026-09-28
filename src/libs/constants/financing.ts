/**
 * Minimum down payment on an in-house installment, as a fraction of the sale
 * amount. Raised from 10% to 30% on the client's instruction (2026-09-28,
 * Scenario 60 item 18).
 *
 * It is a FLOOR, not a fixed amount — a customer may pay more, and a curated
 * per-SKU down payment from a price list may sit above it. It applies in both
 * places a down payment is accepted: the credit application at intake, and an
 * in-house installment line at checkout.
 *
 * **Must stay in step with the backend**, which enforces the same figure in
 * `src/common/constants/financing.constants.ts`. The client check exists to
 * fail fast with a readable message; the server's is the one that counts, so
 * a drift between them shows up as a form that accepts a value the till then
 * rejects.
 *
 * Named rather than inlined because the previous 10% was a magic number
 * repeated across both repos — fifteen sites, several of them user-facing
 * copy that drifted out of step with the rule it described.
 */
export const DOWN_PAYMENT_FLOOR_RATE = 0.3

/** The same figure for user-facing copy, so a message or badge can never
 * claim a percentage the check does not enforce. */
export const DOWN_PAYMENT_FLOOR_LABEL = `${DOWN_PAYMENT_FLOOR_RATE * 100}%`

/** Half-a-centavo tolerance — the form rounds to 2dp, so an exact `>=` would
 * reject a figure that is correct to the centavo. */
export const DOWN_PAYMENT_FLOOR_TOLERANCE = 0.005
