interface CartLineForTax {
  unitPrice: number
  quantity: number
  taxRate?: number | null
  pricingMode?: 'inclusive' | 'exclusive' | null
}

interface PricingTotals {
  vatExclSubtotalForBackend: number
  effectiveTaxRate: number | null
  taxTotal: number
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
  const vatExclSubtotalForBackend = cart.reduce((s, l) => {
    const rate =
      l.pricingMode === 'exclusive'
        ? 0
        : l.pricingMode === 'inclusive' || inclusivePricing
          ? (l.taxRate ?? activeTaxRate?.rate ?? 0)
          : 0
    return s + (rate > 0 ? (l.unitPrice / (1 + rate / 100)) * l.quantity : l.unitPrice * l.quantity)
  }, 0)

  const effectiveTaxRate = !isTaxExempt && activeTaxRate != null ? activeTaxRate.rate : null

  const taxTotal = isTaxExempt
    ? 0
    : inclusivePricing
      ? Math.round((rawSubtotal - vatExclSubtotalForBackend) * 100) / 100
      : effectiveTaxRate != null
        ? Math.round(rawSubtotal * (effectiveTaxRate / 100) * 100) / 100
        : 0

  return { vatExclSubtotalForBackend, effectiveTaxRate, taxTotal }
}
