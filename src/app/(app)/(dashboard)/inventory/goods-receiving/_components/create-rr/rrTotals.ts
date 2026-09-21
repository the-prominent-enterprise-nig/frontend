import type { ReceiveStockFormValues } from '@/src/schema/inventory/goods-receiving'

// Mirrors FLAT_VAT_RATE_PERCENT (tax.constants.ts / StockService.receiveStock)
// — preview only.
const VAT_RATE = 0.12

// Scenario 55 (Stock-side Manual RR parity) — mirrors manualRrCosting.ts's
// own constant of the same name exactly: real BIR EWT rates vary by the
// nature of the payment, not one flat document-wide rate, and a single
// delivery can mix both (e.g. goods plus an installation/service fee).
const WITHHOLDING_RATES: Record<string, number> = {
  goods: 0.01,
  services: 0.02,
}

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
}

/**
 * What this delivery is worth, mirroring receiveStock()'s own per-line model
 * exactly (Scenario 55, Stock-side Manual RR parity — see
 * manualRrCosting.ts's identical twin for the reasoning): both VAT and
 * withholding are computed per line rather than off a single document-wide
 * treatment. A line coded 'VAT' has its typed unitCost treated as
 * VAT-inclusive and 12% is backed out of it; every other code (Non-VAT/
 * Exempt/none) leaves it as-is. A line classed 'goods' withholds 1% of its
 * own net cost, 'services' withholds 2% — summed into one document-level
 * figure.
 *
 * Per-line `taxAmount` is deliberately not rolled up here: it exists so an AP
 * bill can match tax line by line, and adding it to a VAT total already
 * derived from the same costs would count the same tax twice.
 */
export function rrTotals(values: { lines?: RrLine[] }): RrTotals {
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

  const vat = round2(
    lines.reduce((sum, line) => {
      if (line.taxCode !== 'VAT') return sum
      const lineGross = lineTotal(line)
      return sum + (lineGross - lineGross / (1 + VAT_RATE))
    }, 0)
  )
  const stock = round2(gross - vat)
  const invoice = gross

  const withheld = round2(
    lines.reduce((sum, line) => {
      const rate = WITHHOLDING_RATES[line.withholdingClass ?? ''] ?? 0
      if (rate === 0) return sum
      const lineGross = lineTotal(line)
      const lineNet = line.taxCode === 'VAT' ? round2(lineGross / (1 + VAT_RATE)) : lineGross
      return sum + lineNet * rate
    }, 0)
  )

  return {
    stock,
    vat,
    invoice,
    withheld,
    net: round2(invoice - withheld),
    units,
    lines: counted,
    freebies,
  }
}
