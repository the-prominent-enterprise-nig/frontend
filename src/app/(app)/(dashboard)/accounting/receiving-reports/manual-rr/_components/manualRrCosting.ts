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

/**
 * Preview-only, mirrors the server's post()-time math exactly (developer
 * decision, 2026-09-19): vatTreatment alone decides, never the resolved
 * source. 'inclusive' (the form's own default) backs 12% VAT out of the
 * gross total and applies 1% withholding on the resulting net; anything
 * else computes neither — gross carries through unchanged.
 */
export function manualRrTotals(
  values: Pick<CreateManualReceivingReportFormValues, 'lines' | 'vatTreatment'>
): ManualRrTotals {
  const gross = (values.lines ?? []).reduce((sum, line) => sum + lineTotal(line), 0)
  const applyTax = (values.vatTreatment ?? 'inclusive') === 'inclusive'
  const vat = !applyTax ? 0 : round2(gross - gross / 1.12)
  const net = round2(gross - vat)
  const withheld = !applyTax ? 0 : round2(net * 0.01)
  const payable = round2(net + vat - withheld)
  return { gross, vat, net, withheld, payable }
}
