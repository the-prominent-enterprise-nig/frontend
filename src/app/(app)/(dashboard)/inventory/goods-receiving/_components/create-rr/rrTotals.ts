import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'

// Mirrors FLAT_VAT_RATE_PERCENT and the 1% withholding rate the server applies
// (tax.constants.ts / StockService.receiveStock) — preview only.
const VAT_RATE = 0.12
const WITHHOLDING_RATE = 0.01

const round2 = (n: number): number => Math.round(n * 100) / 100

export type RrLine = ReceiveStockFormValues['lines'][number]
export type Discount = NonNullable<RrLine['discounts']>[number]

/** Unit cost as the supplier's own pricing produces it: SRP walked through the
 * discount chain, in order. A freebie is zero however it was priced — the
 * server forces that too, so showing anything else here would be a lie the
 * post then corrects. */
export function costFromPricing(
  line: Pick<RrLine, 'srp' | 'discounts' | 'isFreebie'>
): number | undefined {
  if (line.isFreebie) return 0
  const srp = Number(line.srp)
  const chain = line.discounts ?? []
  if (!srp || chain.length === 0) return undefined
  const priced = chain.reduce((price, discount) => {
    const value = Number(discount?.value)
    if (!discount?.type || Number.isNaN(value)) return price
    return discount.type === 'percentage' ? price * (1 - value / 100) : price - value
  }, srp)
  return Math.max(0, round2(priced))
}

/** What one line adds to the supplier's invoice. */
export function lineTotal(
  line: Pick<RrLine, 'quantityReceived' | 'unitCost' | 'isFreebie'>
): number {
  if (line.isFreebie) return 0
  return round2((line.quantityReceived || 0) * (line.unitCost ?? 0))
}

export type RrTotals = {
  /** Goods value with VAT carved out of it — what lands on the ledger. */
  stock: number
  vat: number
  /** What the supplier bills. */
  invoice: number
  withheld: number
  /** Invoice less withholding — what actually gets remitted. */
  net: number
  units: number
  lines: number
  freebies: number
  vatIsDerived: boolean
  withheldIsDerived: boolean
}

/**
 * What this delivery is worth, derived the same way the server derives it when
 * it posts.
 *
 * `vatTreatment` is the question the header field actually asks: PH supplier
 * invoices normally quote VAT-inclusive prices, so the tax is carved back out
 * of the entered unit costs rather than added on top. Either derived figure
 * can be overridden by typing the amount the supplier's own paperwork states —
 * which is why both are reported as derived-or-not, so the panel can say which
 * it is showing.
 *
 * Per-line `taxAmount` is deliberately not rolled up here: it exists so an AP
 * bill can match tax line by line, and adding it to a header VAT already
 * derived from the same costs would count the same tax twice.
 */
export function rrTotals(values: {
  lines?: RrLine[]
  vatTreatment?: ReceiveStockFormValues['vatTreatment']
  vatAmount?: number
  withholding?: ReceiveStockFormValues['withholding']
  withheldAmount?: number
}): RrTotals {
  const lines = values.lines ?? []
  let gross = 0
  let units = 0
  let counted = 0
  let freebies = 0

  for (const line of lines) {
    const qty = line.quantityReceived || 0
    if (qty <= 0) continue
    units += qty
    counted += 1
    if (line.isFreebie) freebies += 1
    gross += lineTotal(line)
  }
  gross = round2(gross)

  const treatment = values.vatTreatment ?? 'inclusive'
  const derivedVat =
    treatment === 'inclusive'
      ? round2(gross - gross / (1 + VAT_RATE))
      : treatment === 'exclusive'
        ? round2(gross * VAT_RATE)
        : 0
  const vatIsDerived = values.vatAmount == null
  const vat = vatIsDerived ? derivedVat : round2(values.vatAmount ?? 0)

  const stock = treatment === 'exclusive' ? gross : round2(gross - vat)
  const invoice = treatment === 'exclusive' ? round2(gross + vat) : gross

  const withheldIsDerived = values.withheldAmount == null
  const derivedWithheld = values.withholding === 'pct_1' ? round2(stock * WITHHOLDING_RATE) : 0
  const withheld = withheldIsDerived ? derivedWithheld : round2(values.withheldAmount ?? 0)

  return {
    stock,
    vat,
    invoice,
    withheld,
    net: round2(invoice - withheld),
    units,
    lines: counted,
    freebies,
    vatIsDerived,
    withheldIsDerived,
  }
}
