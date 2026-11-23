/**
 * Docket #92 — what a price use limits, as the checkout reads it: the payment
 * types, the terms and the typed plan a price use allows (the five SPLIT uses
 * allow only their own). The pure half, so the till offers only what the
 * server will accept.
 *
 * **Must stay in step with the backend**, whose `src/pos/price-use-rules.util.ts`
 * holds the same checks and is the one that counts. This copy exists to keep the
 * cashier from choosing what the server will refuse and to say why in plain
 * words; a price use with no rules (or none loaded) never restricts anything.
 */

/** How a sale line is paid, as a price use sees it. `inhouse` is NIG's own
 * installment; `tpf` is an outside financier paying NIG at the time of sale. */
export type PaymentType = 'cash' | 'inhouse' | 'tpf'

export const PAYMENT_TYPES: readonly PaymentType[] = ['cash', 'inhouse', 'tpf']

/** The rule columns of a price use (`PosPriceUseType` carries them). */
export interface PriceUseRules {
  name: string
  /** Empty = every payment type. */
  allowedPaymentTypes: string[]
  /** Months an in-house installment may take. Empty = any active term. */
  allowedTermMonths: number[]
  /** Cap on the term in months; null = no cap. */
  maxTermMonths: number | null
  allowTypedPlan: boolean
  zeroPercentNeedsReason: boolean
}

export function hasRules(rules: PriceUseRules): boolean {
  return (
    rules.allowedPaymentTypes.length > 0 ||
    rules.allowedTermMonths.length > 0 ||
    rules.maxTermMonths != null ||
    !rules.allowTypedPlan ||
    rules.zeroPercentNeedsReason
  )
}

export function isPaymentTypeAllowed(rules: PriceUseRules, type: PaymentType): boolean {
  return rules.allowedPaymentTypes.length === 0 || rules.allowedPaymentTypes.includes(type)
}

/** Whether an in-house installment of `months` is allowed: on the allow-list
 * when there is one, and not over the cap when there is one. */
export function isTermAllowed(rules: PriceUseRules, months: number): boolean {
  if (rules.allowedTermMonths.length > 0 && !rules.allowedTermMonths.includes(months)) {
    return false
  }
  return rules.maxTermMonths == null || months <= rules.maxTermMonths
}

/** The payment types every price use on the cart allows. A cart's payment mode
 * is one choice for the whole cart, so this is what can be offered. */
export function commonPaymentTypes(rulesList: PriceUseRules[]): PaymentType[] {
  return PAYMENT_TYPES.filter((type) =>
    rulesList.every((rules) => isPaymentTypeAllowed(rules, type))
  )
}

const PAYMENT_TYPE_WORDS: Record<PaymentType, string> = {
  cash: 'cash',
  inhouse: 'installment',
  tpf: 'TPF',
}

function joinWithOr(words: string[]): string {
  if (words.length <= 1) return words.join('')
  return `${words.slice(0, -1).join(', ')} or ${words[words.length - 1]}`
}

/** "cash", "cash or TPF", "cash, installment or TPF" — canonical order. */
export function describePaymentTypes(types: string[]): string {
  return joinWithOr(
    PAYMENT_TYPES.filter((type) => types.includes(type)).map((type) => PAYMENT_TYPE_WORDS[type])
  )
}

/** "3 months", "1 month", "6, 9 or 12 months". */
export function formatMonths(months: number[]): string {
  const sorted = [...new Set(months)].sort((a, b) => a - b)
  if (sorted.length === 1) return `${sorted[0]} ${sorted[0] === 1 ? 'month' : 'months'}`
  return `${joinWithOr(sorted.map(String))} months`
}

/**
 * Why none of `anyOf` can be chosen, or null when at least one of them is
 * allowed by every price use on the cart. For a toggle's tooltip: names the
 * price use that stops it and what that use does sell for, or says the uses
 * on the cart have nothing in common.
 */
export function paymentBlockReason(
  rulesList: PriceUseRules[],
  anyOf: PaymentType[]
): string | null {
  if (anyOf.some((type) => rulesList.every((rules) => isPaymentTypeAllowed(rules, type)))) {
    return null
  }
  const culprit = rulesList.find((rules) =>
    anyOf.every((type) => !isPaymentTypeAllowed(rules, type))
  )
  if (culprit) {
    return `${culprit.name} is sold for ${describePaymentTypes(culprit.allowedPaymentTypes)} only.`
  }
  return 'The price uses on this sale have no payment type in common.'
}
