import type { DrPurpose, DrStatus } from '@/src/schema/inventory/delivery-receipts'
import { DR_PURPOSE_CONFIG } from '@/src/libs/inventory/delivery-receipt-purposes'

export const DR_STATUS_META: Record<DrStatus, { label: string; badge: string }> = {
  draft: { label: 'Draft', badge: 'bg-[#f1f1f4] text-[#3d3d4a]' },
  pending_approval: { label: 'Pending approval', badge: 'bg-[#fdf3e7] text-[#8a4b06]' },
  approved: { label: 'Approved', badge: 'bg-[#f1ebfb] text-[#3f1490]' },
  posted: { label: 'Posted', badge: 'bg-[#e7f5ef] text-[#0b6644]' },
  invoiced: { label: 'Invoiced', badge: 'bg-[#eaf0fb] text-[#1f4b99]' },
  rejected: { label: 'Rejected', badge: 'bg-[#fdeceb] text-[#8f1c14]' },
  voided: { label: 'Voided', badge: 'bg-[#f1f1f4] text-[#8b8b9b] line-through' },
}

/** "Approved" means different things per purpose; say which. */
export function drStatusLabel(status: DrStatus, purpose: DrPurpose): string {
  if (status !== 'approved') return DR_STATUS_META[status].label
  if (purpose === 'sales_invoice_to_follow') return 'Held for POS'
  return DR_PURPOSE_CONFIG[purpose].withDebitMemo ? 'Awaiting accounting' : 'Approved'
}

export function fmtDrDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function fmtPeso(n: number): string {
  return `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
