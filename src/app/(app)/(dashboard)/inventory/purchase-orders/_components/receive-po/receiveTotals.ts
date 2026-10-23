import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import {
  fallbackEwtRate,
  NO_WITHHOLDING_CODE,
  supplierEwtCode,
  type EwtRateFor,
} from '@/src/libs/tax/ewt'

// Mirrors FLAT_VAT_RATE_PERCENT, which the server applies (tax.constants.ts /
// StockService.receiveStock) — preview only. Withholding is the supplier's EWT
// tax code at the rate the tax code master holds (see useEwtCodes()).
const INPUT_VAT_RATE = 0.12

const round2 = (n: number): number => Math.round(n * 100) / 100

export const fmtPeso = (n: number): string =>
  (n || 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export type ReceiptTotals = {
  /** What the supplier bills — unit costs are VAT-inclusive. */
  invoice: number
  /** Goods value with the VAT carved back out of it. */
  stock: number
  vat: number
  withheld: number
  /** Invoice less withholding — what actually gets remitted. */
  net: number
  units: number
  lines: number
  chargesInputVat: boolean
  withholdsTax: boolean
  /** The EWT code the delivery is withheld at, and its rate in percent. */
  withholdingCode?: string
  withholdingPercent?: number
}

export type TotalsLine = {
  selected: boolean
  quantityReceived: number
  unitCost?: number
}

/**
 * Live preview of what the supplier's invoice should total.
 *
 * Both taxes are derived from the supplier's own profile rather than typed off
 * the SI — the server recomputes them the same way when it posts
 * (StockService.receiveStock) and ignores anything sent from here, so a figure
 * derived any other way could only ever disagree with what actually lands. The
 * withholding rate is the one `rateFor` reads off the tax code master for the
 * supplier's EWT code.
 */
export function receiptTotals(
  lines: TotalsLine[],
  supplier: PurchaseOrderSummary['supplier'],
  rateFor: EwtRateFor = fallbackEwtRate
): ReceiptTotals {
  let invoice = 0
  let units = 0
  let lineCount = 0

  for (const line of lines) {
    if (!line.selected || line.quantityReceived <= 0) continue
    invoice += line.quantityReceived * (line.unitCost ?? 0)
    units += line.quantityReceived
    lineCount += 1
  }

  const chargesInputVat = supplier?.defaultInputVat !== 'none'
  const vat = chargesInputVat ? round2(invoice - invoice / (1 + INPUT_VAT_RATE)) : 0
  const stock = round2(invoice - vat)
  // A supplier that hasn't loaded yet says nothing either way — no
  // withholding to preview, rather than the default one.
  const knowsWithholding =
    supplier?.defaultWithholding != null || !!supplier?.defaultWithholdingTaxCode
  const withholdingCode = knowsWithholding ? supplierEwtCode(supplier) : NO_WITHHOLDING_CODE
  const withholdingRate = rateFor(withholdingCode)
  const withholdsTax = withholdingRate > 0
  const withheld = withholdsTax ? round2(stock * withholdingRate) : 0

  return {
    invoice: round2(invoice),
    stock,
    vat,
    withheld,
    net: round2(invoice - withheld),
    units,
    lines: lineCount,
    chargesInputVat,
    withholdsTax,
    withholdingCode,
    withholdingPercent: withholdingRate * 100,
  }
}

export type ReceivingProgress = {
  ordered: number
  toDate: number
  /** Units on this delivery, i.e. what the bar's middle segment represents. */
  now: number
  pctDone: number
  pctNow: number
  pctAfter: number
  outstandingAfter: number
}

/** How far this PO has been delivered, and where this receipt takes it. */
export function receivingProgress(
  poLines: PurchaseOrderSummary['lines'],
  unitsNow: number
): ReceivingProgress {
  const ordered = poLines.reduce((sum, l) => sum + Number(l.quantity), 0)
  const toDate = poLines.reduce((sum, l) => sum + Number(l.receivedQuantity ?? 0), 0)
  // A PO with no lines would otherwise divide by zero and render NaN%.
  const pct = (n: number) => (ordered > 0 ? Math.min(100, Math.round((n / ordered) * 100)) : 0)
  const pctDone = pct(toDate)
  const pctNow = pct(unitsNow)

  return {
    ordered,
    toDate,
    now: unitsNow,
    pctDone,
    pctNow,
    pctAfter: Math.min(100, pctDone + pctNow),
    outstandingAfter: Math.max(0, ordered - toDate - unitsNow),
  }
}
