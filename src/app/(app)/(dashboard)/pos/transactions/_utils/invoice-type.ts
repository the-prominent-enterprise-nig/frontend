import type { PosInvoiceType, PosTransaction } from '@/src/schema/pos'

/** Ticket #24 follow-up — "add column for invoice type, example cash or
 * installment". How the customer is paying for the sale, as the Transactions
 * list shows it beside the sale / refund / exchange Type. */
export interface InvoiceTypeTag {
  label: string
  className: string
}

type LineMode = Exclude<PosInvoiceType, 'mixed'>

const MODE_LABEL: Record<LineMode, string> = {
  cash: 'Cash',
  charge: 'Charge',
  installment: 'Installment',
}

const TAG_CLASS: Record<PosInvoiceType, string> = {
  cash: 'bg-emerald-50 text-emerald-700',
  charge: 'bg-amber-50 text-amber-700',
  installment: 'bg-prominent-purple-50 text-prominent-purple-700',
  mixed: 'bg-sky-50 text-sky-700',
}

/** The Invoice Type filter's choices — the same names the column shows. The
 * server reads them the same way (backend transactions.service.ts,
 * invoiceTypeWhere). */
export const INVOICE_TYPE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'installment', label: 'Installment (all)' },
  { value: 'installment_inhouse', label: 'Installment (In-house)' },
  { value: 'installment_tpf', label: 'Installment (TPF)' },
  { value: 'charge', label: 'Charge' },
  { value: 'mixed', label: 'Mixed' },
]

/** "Installment (TPF)" when every installment line is TPF, "Installment
 * (In-house)" when none is — a line with no provider is in-house, the
 * default, and so is an older sale whose lines never recorded one — and
 * plain "Installment" for a sale with both. */
function installmentLabel(providers: Set<string>): string {
  if (!providers.has('tpf')) return 'Installment (In-house)'
  return providers.size === 1 ? 'Installment (TPF)' : MODE_LABEL.installment
}

/** Each line's own mode is the source of truth; the sale's invoiceType is
 * their summary ('mixed' when they disagree), and the fallback for older
 * lines stored without one. */
export function invoiceTypeTag(tx: PosTransaction): InvoiceTypeTag {
  const saleType: PosInvoiceType = tx.invoiceType ?? 'cash'
  const lineModes = (tx.lines ?? []).map((l) => ({
    mode: (l.invoiceType ?? saleType) as PosInvoiceType,
    provider: l.installmentProvider ?? 'inhouse',
  }))
  const providers = new Set(
    lineModes.filter((l) => l.mode === 'installment').map((l) => l.provider)
  )
  const labelOf = (mode: LineMode): string =>
    mode === 'installment' ? installmentLabel(providers) : MODE_LABEL[mode]

  if (saleType !== 'mixed') return { label: labelOf(saleType), className: TAG_CLASS[saleType] }

  const modes = [
    ...new Set(lineModes.map((l) => l.mode).filter((m): m is LineMode => m !== 'mixed')),
  ]
  return {
    label: modes.length > 0 ? modes.map(labelOf).join(' + ') : 'Mixed',
    className: TAG_CLASS.mixed,
  }
}
