import type { CreateManualReceivingReportFormValues } from '@/src/schema/inventory/manual-receiving-reports'

// Scenario 53 (2nd pass) — mirrors goods-receiving/create-rr/rrTotals.ts's
// costFromPricing(): SRP walked through the discount chain, in order. A
// freebie is zero however it was priced. Returns undefined (not 0) when
// there's no SRP to chain off — that's a hand-typed unitCost, and this
// function must never silently overwrite one.
export type ManualRrLine = CreateManualReceivingReportFormValues['lines'][number]
export type ManualRrDiscount = NonNullable<ManualRrLine['discounts']>[number]

const round2 = (n: number): number => Math.round(n * 100) / 100

export function costFromPricing(
  line: Pick<ManualRrLine, 'srp' | 'discounts' | 'isFreebie'>
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

export function lineTotal(
  line: Pick<ManualRrLine, 'quantityReceived' | 'unitCost' | 'isFreebie'>
): number {
  if (line.isFreebie) return 0
  const qty = Number(line.quantityReceived) || 0
  const cost = Number(line.unitCost) || 0
  return round2(qty * cost)
}

export type ManualRrTotals = {
  gross: number
  vat: number
  net: number
  withheld: number
  payable: number
}

// Real BIR EWT rates vary by the nature of the payment, not one flat
// document-wide rate — goods and services are withheld differently, and a
// single delivery can mix both. Independent of taxCode: a line can be
// VAT + Goods, Exempt + Services, etc.
const WITHHOLDING_RATES: Record<string, number> = {
  goods: 0.01,
  services: 0.02,
}

/** This line's own VAT-exclusive net cost — the base withholding applies
 * off, same as the server. */
function lineNet(
  line: Pick<ManualRrLine, 'quantityReceived' | 'unitCost' | 'isFreebie' | 'taxCode'>
): number {
  const gross = lineTotal(line)
  return line.taxCode === 'VAT' ? round2(gross / 1.12) : gross
}

/**
 * Preview-only, mirrors the server's post()-time math exactly (developer
 * decision, 2026-09-20): both VAT and withholding are per line, not a
 * document-wide toggle. A line coded 'VAT' has its unitCost treated as
 * VAT-inclusive and 12% backed out of it; every other code (Non-VAT/Exempt/
 * none) leaves it as-is. A line classed 'goods' withholds 1% of its own net
 * cost, 'services' withholds 2% — summed into one document-level figure.
 */
export function manualRrTotals(
  values: Pick<CreateManualReceivingReportFormValues, 'lines'>
): ManualRrTotals {
  const lines = values.lines ?? []
  const gross = lines.reduce((sum, line) => sum + lineTotal(line), 0)
  const vat = round2(
    lines.reduce((sum, line) => {
      if (line.taxCode !== 'VAT') return sum
      const lineGross = lineTotal(line)
      return sum + (lineGross - lineGross / 1.12)
    }, 0)
  )
  const net = round2(gross - vat)
  const withheld = round2(
    lines.reduce((sum, line) => {
      const rate = WITHHOLDING_RATES[line.withholdingClass ?? ''] ?? 0
      return rate === 0 ? sum : sum + lineNet(line) * rate
    }, 0)
  )
  const payable = round2(net + vat - withheld)
  return { gross, vat, net, withheld, payable }
}
