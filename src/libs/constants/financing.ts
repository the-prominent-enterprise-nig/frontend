/**
 * Minimum down payment on an installment, as a fraction of the sale amount,
 * for an item whose price-list row does not price it for the chosen term.
 *
 * Scenario 64 raised this to 30% (item 18, 2026-09-28) and then ignored the
 * rate card's own down payment in its favour (item 22). Both were reversed
 * on 2026-10-02 after the PR #199 review: the rate card's monthly installment
 * is calculated from the card's own down payment, so 30% down with the card's
 * monthly overcharged the customer by exactly the difference. This is
 * development's 10% again; where the card quotes a down payment AND a monthly
 * for the term, that down payment is the down payment, fixed — see
 * `isCardTerm()` below and the backend's resolveCardDownPayment().
 *
 * It is a FLOOR, not a fixed amount — a customer may pay more. It applies in
 * both places a down payment is accepted: the credit application at intake,
 * and an installment line at checkout.
 *
 * **Must stay in step with the backend**, which enforces the same figure in
 * `src/common/constants/financing.constants.ts`. The client check exists to
 * fail fast with a readable message; the server's is the one that counts, so
 * a drift between them shows up as a form that accepts a value the till then
 * rejects.
 *
 * Named rather than inlined because the 10% used to be a magic number
 * repeated across both repos — fifteen sites, several of them user-facing
 * copy that drifted out of step with the rule it described.
 */
export const DOWN_PAYMENT_FLOOR_RATE = 0.1

/** The same figure for user-facing copy, so a message or badge can never
 * claim a percentage the check does not enforce. */
export const DOWN_PAYMENT_FLOOR_LABEL = `${DOWN_PAYMENT_FLOOR_RATE * 100}%`

/** Half-a-centavo tolerance — the form rounds to 2dp, so an exact `>=` would
 * reject a figure that is correct to the centavo. */
export const DOWN_PAYMENT_FLOOR_TOLERANCE = 0.005

/**
 * Whether a price-list row fixes the down payment for a term: it has a down
 * payment of its own AND quotes a monthly for that many months. The card's
 * monthly was calculated from exactly that down payment, so any other figure
 * would mis-state what the customer owes (PR #199 review). A card that does
 * not quote the term is priced by the factor rate instead, which works from
 * whatever down payment is given — the floor applies there.
 */
export function isCardTerm(
  row:
    | { downPayment?: number | string | null; cardTermMonths?: number[] | null }
    | null
    | undefined,
  termMonths: number | null | undefined
): boolean {
  return (
    row?.downPayment != null &&
    termMonths != null &&
    (row.cardTermMonths ?? []).includes(termMonths)
  )
}
