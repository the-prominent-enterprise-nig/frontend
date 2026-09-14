// Shared type tokens and small formatters for the procurement screens, which
// follow the Purchase Orders / Create Purchase Order designs' own IBM Plex +
// #5b21b6 palette rather than the app-wide Poppins brand tokens. The two font
// CSS variables are registered by next/font in app/layout.tsx.
//
// Colours stay as inline Tailwind arbitrary values at each call site — they
// vary per element, whereas these two are applied wholesale.
//
// STATUS_META / fmtPeso / fmtDate / receiptTotals / daysLate / StatusBadge /
// SupplierAvatar live here (not duplicated per component) because the same
// purchase order shows up in both the list and its detail panel — two
// independently hand-rolled copies of a status badge's colours is how they
// quietly drift apart.

import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'

// Re-exported so existing procurement call sites keep importing from here;
// price lists share the same language, so the definitions moved to
// libs/design/plex.ts. CONTROL_CHROME is passed to SearchableSelect's
// `chrome` prop.
export { CONTROL_CHROME, PLEX, MONO } from '@/src/libs/design/plex'

export type PoStatus = PurchaseOrderSummary['status']

export const STATUS_META: Record<PoStatus, { label: string; badge: string }> = {
  draft: { label: 'Pending', badge: 'bg-[#f1f1f4] text-[#3d3d4a]' },
  approved: { label: 'Approved', badge: 'bg-[#f1ebfb] text-[#3f1490]' },
  sent: { label: 'Sent', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  partially_received: { label: 'Partial', badge: 'bg-[#fdf3e7] text-[#8a4b06]' },
  fully_received: { label: 'Received', badge: 'bg-[#e7f5ef] text-[#0b6644]' },
  closed: { label: 'Closed', badge: 'bg-[#f6f6f8] text-[#5b5b6b]' },
  cancelled: { label: 'Cancelled', badge: 'bg-[#fdeceb] text-[#b42318]' },
}

const AVATAR_PALETTE = [
  'bg-[#eaf0fb] text-[#1f4b99]',
  'bg-[#f1ebfb] text-[#3f1490]',
  'bg-[#fdeceb] text-[#b42318]',
  'bg-[#e7f5ef] text-[#0b6644]',
  'bg-[#fdf3e7] text-[#8a4b06]',
]

export function fmtPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function receiptTotals(lines: PurchaseOrderSummary['lines']): {
  received: number
  ordered: number
  pct: number
} {
  const ordered = lines.reduce((s, l) => s + Number(l.quantity), 0)
  const received = lines.reduce((s, l) => s + Number(l.receivedQuantity ?? 0), 0)
  const pct = ordered > 0 ? Math.min(Math.round((received / ordered) * 100), 100) : 0
  return { received, ordered, pct }
}

/** Whole days past the expected delivery date; 0 once the PO is settled. */
export function daysLate(po: PurchaseOrderSummary): number {
  const settled: PoStatus[] = ['fully_received', 'closed', 'cancelled']
  if (!po.expectedDeliveryDate || settled.includes(po.status)) return 0
  const due = new Date(po.expectedDeliveryDate)
  const diff = Math.floor((Date.now() - due.getTime()) / 86_400_000)
  return diff > 0 ? diff : 0
}

export function StatusBadge({
  status,
  className = '',
}: {
  status: PoStatus
  className?: string
}): React.ReactElement {
  const meta = STATUS_META[status] ?? STATUS_META.draft
  return (
    <span
      className={`whitespace-nowrap rounded-[5px] px-[9px] py-[3px] text-[11.5px] font-medium ${meta.badge} ${className}`}
    >
      {meta.label}
    </span>
  )
}

export function SupplierAvatar({
  name,
  className = 'h-[26px] w-[26px] text-[11px]',
}: {
  name: string
  className?: string
}): React.ReactElement {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  const tone = AVATAR_PALETTE[initial.charCodeAt(0) % AVATAR_PALETTE.length]
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${tone} ${className}`}
    >
      {initial}
    </span>
  )
}
