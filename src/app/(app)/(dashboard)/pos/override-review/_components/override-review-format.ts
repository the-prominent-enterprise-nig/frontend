import type { OverrideFlag, OverrideEntryStatus, OverridePlanKind } from '@/src/schema/pos'

export function peso(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  return Number(amount).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  })
}

export function pct(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Number(value).toFixed(1)}%`
}

/** The flag chip's wording. "Over 10%" says how far under list the business flags
 * from; the rest name what the cashier did. */
export function flagLabel(flag: OverrideFlag, thresholdPct: number): string {
  switch (flag) {
    case 'over_threshold':
      return `Over ${Number(thresholdPct)}%`
    case 'no_list_price':
      return 'No list price'
    case 'typed_terms':
      return 'Manual terms'
    case 'dp_waived':
      return 'DP waived'
    case 'credit_waived':
      return 'Credit app waived'
    case 'credit_overridden':
      return 'Credit app overridden'
    case 'credit_warning':
      return 'Credit warning'
  }
}

/** Amber for things worth a second look, red for the ones that cost money. */
export const FLAG_STYLES: Record<OverrideFlag, string> = {
  over_threshold: 'bg-amber-100 text-amber-800',
  no_list_price: 'bg-amber-100 text-amber-800',
  typed_terms: 'bg-amber-100 text-amber-800',
  dp_waived: 'bg-red-100 text-red-700',
  credit_waived: 'bg-red-100 text-red-700',
  credit_overridden: 'bg-red-100 text-red-700',
  credit_warning: 'bg-red-100 text-red-700',
}

export const STATUS_LABELS: Record<OverrideEntryStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  voided: 'Sale voided',
}

export const STATUS_STYLES: Record<OverrideEntryStatus, string> = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  voided: 'bg-gray-100 text-gray-500',
}

export const PLAN_LABELS: Record<OverridePlanKind, string> = {
  cash: 'Cash',
  installment_term: 'In-house installment',
  installment_typed: 'In-house installment',
  tpf: 'Third-party financing',
}

/** The payment type in a word, for the one-line row; the details say the rest. */
export const PLAN_SHORT: Record<OverridePlanKind, string> = {
  cash: 'Cash',
  installment_term: 'Installment',
  installment_typed: 'Installment',
  tpf: 'Financing',
}

/** One column template for the header and every row, so they line up exactly.
 * Chevron, Sale, Branch, Customer, Item, Price, Discount, Payment, Flags, Decision. */
export const ENTRY_GRID =
  'grid grid-cols-[28px_132px_72px_minmax(0,1fr)_minmax(0,1.6fr)_84px_120px_88px_124px_148px] items-center gap-x-4 px-3'

/** The row's left edge, so a day's worth reads by status before any text does. */
export const STATUS_ACCENT: Record<OverrideEntryStatus, string> = {
  pending: 'border-l-orange-400',
  approved: 'border-l-green-500',
  rejected: 'border-l-red-500',
  voided: 'border-l-gray-300',
}

export function formatTime(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
}

export function formatDay(iso: string | null): string {
  if (!iso) return '—'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return '—'
  return at.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** HH:mm on a 24-hour clock, as the review table reads. */
export function formatClock(iso: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false })
}
