import type {
  OverrideFlag,
  OverrideEntryStatus,
  OverridePlanKind,
  OverrideReviewEntry,
} from '@/src/schema/pos'

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
  installment_term: 'Installment — rate card',
  installment_typed: 'Installment — typed terms',
  tpf: 'Third-party financing',
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

/**
 * The plan in one line, the way a manager reads it across the table:
 * "In-house installment: DP ₱0.00, ₱2,750.00 x 12 months (manual) | Credit
 * application waived | 2 items on one sale".
 */
export function planText(e: OverrideReviewEntry, itemsOnSale: number): string {
  const parts: string[] = []
  if (e.planKind === 'cash') {
    parts.push('Cash')
  } else if (e.planKind === 'tpf') {
    parts.push(
      e.downPayment !== null
        ? `Third-party financing: DP ${peso(e.downPayment)}`
        : 'Third-party financing'
    )
  } else {
    const bits: string[] = []
    if (e.downPayment !== null) bits.push(`DP ${peso(e.downPayment)}`)
    if (e.monthlyInstallment !== null && e.termMonths !== null) {
      bits.push(`${peso(e.monthlyInstallment)} x ${e.termMonths} months`)
    } else if (e.termMonths !== null) {
      bits.push(`${e.termMonths} months`)
    }
    parts.push(
      `In-house installment${bits.length ? `: ${bits.join(', ')}` : ''}${
        e.planKind === 'installment_typed' ? ' (manual)' : ''
      }`
    )
  }
  if (e.flags.includes('credit_waived')) parts.push('Credit application waived')
  if (e.flags.includes('credit_overridden')) parts.push('Credit application overridden')
  if (itemsOnSale > 1) parts.push(`${itemsOnSale} items on one sale`)
  return parts.join(' | ')
}
