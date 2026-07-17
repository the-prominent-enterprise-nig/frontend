interface PriceableLine {
  unitPrice: number
  taxRate?: number | null
  pricingMode?: 'inclusive' | 'exclusive' | null
}

interface CartLineForTax extends PriceableLine {
  quantity: number
}

interface PricingTotals {
  vatExclSubtotalForBackend: number
  /** Tax that still needs to be added on top of rawSubtotal to reach the
   * payable total — zero for inclusive lines (their tax is already baked
   * into unitPrice), the full line tax for exclusive lines. */
  additiveTax: number
  taxTotal: number
}

/** The tax rate that actually applies to a single line/catalog item — its own
 * (possibly branch-overridden) rate takes priority over the tenant-wide
 * default, so a branch price override's custom rate is never silently
 * discarded in favor of Accounting's default rate. */
export function resolveLineTaxRate(
  line: { taxRate?: number | null },
  activeTaxRate: { rate: number } | null
): number | null {
  return line.taxRate ?? activeTaxRate?.rate ?? null
}

export function isLineInclusive(line: PriceableLine, inclusivePricing: boolean): boolean {
  if (line.pricingMode === 'exclusive') return false
  return line.pricingMode === 'inclusive' || inclusivePricing
}

/** The unit price to actually display for a line/catalog item: shown as-is
 * when its price already includes tax (inclusive), or with tax added on top
 * when it doesn't yet (exclusive) — mirroring exactly how
 * computePricingTotals treats the same line for the cart's real totals, so a
 * displayed line price can never disagree with what Order Summary charges. */
export function displayUnitPriceWithTax(
  line: PriceableLine,
  activeTaxRate: { rate: number } | null,
  inclusivePricing: boolean
): number {
  const rate = resolveLineTaxRate(line, activeTaxRate)
  if (rate == null || rate <= 0 || isLineInclusive(line, inclusivePricing)) return line.unitPrice
  return line.unitPrice * (1 + rate / 100)
}

/** The VAT amount actually attributable to one line — the embedded portion
 * for an inclusive line (extracted out of unitPrice, not added on top of it),
 * or the additive portion for an exclusive line. Mirrors the per-line
 * treatment inside computePricingTotals so a line's own submitted taxAmount
 * always agrees with the cart-level totals. */
export function lineTaxAmount(
  line: CartLineForTax,
  activeTaxRate: { rate: number } | null,
  inclusivePricing: boolean
): number {
  const rate = resolveLineTaxRate(line, activeTaxRate)
  if (rate == null || rate <= 0) return 0
  const lineRaw = line.unitPrice * line.quantity
  if (isLineInclusive(line, inclusivePricing)) {
    return lineRaw - lineRaw / (1 + rate / 100)
  }
  return lineRaw * (rate / 100)
}

export function computePricingTotals({
  cart,
  rawSubtotal,
  inclusivePricing,
  activeTaxRate,
  isTaxExempt,
}: {
  cart: CartLineForTax[]
  rawSubtotal: number
  inclusivePricing: boolean
  activeTaxRate: { rate: number } | null
  isTaxExempt: boolean
}): PricingTotals {
  // A branch price override can set pricingMode independently of the
  // tenant-wide default, so a cart can legitimately mix inclusive and
  // exclusive lines. Each line's own tax contribution — embedded (inclusive)
  // or additive (exclusive) — is computed on its own terms below, rather than
  // branching once on the global default and silently dropping any line that
  // disagrees with it.
  let vatExclSubtotalForBackend = 0
  let totalVat = 0
  let additiveTax = 0

  if (!isTaxExempt) {
    for (const l of cart) {
      const lineRaw = l.unitPrice * l.quantity
      const rate = resolveLineTaxRate(l, activeTaxRate) ?? 0

      if (rate <= 0) {
        vatExclSubtotalForBackend += lineRaw
        continue
      }

      if (isLineInclusive(l, inclusivePricing)) {
        const exclBase = lineRaw / (1 + rate / 100)
        vatExclSubtotalForBackend += exclBase
        totalVat += lineRaw - exclBase
      } else {
        const lineVat = lineRaw * (rate / 100)
        vatExclSubtotalForBackend += lineRaw
        totalVat += lineVat
        additiveTax += lineVat
      }
    }
  } else {
    vatExclSubtotalForBackend = cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  }

  return {
    vatExclSubtotalForBackend: Math.round(vatExclSubtotalForBackend * 100) / 100,
    additiveTax: isTaxExempt ? 0 : Math.round(additiveTax * 100) / 100,
    taxTotal: isTaxExempt ? 0 : Math.round(totalVat * 100) / 100,
  }
}
