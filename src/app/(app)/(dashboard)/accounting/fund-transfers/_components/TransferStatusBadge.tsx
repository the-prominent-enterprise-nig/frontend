import type { FundTransferClearingStatus } from '@/src/libs/data/AccountingV2Data'

const STYLES: Record<FundTransferClearingStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700' },
  cleared: { label: 'Cleared', className: 'bg-green-100 text-green-700' },
  void: { label: 'Void', className: 'bg-red-100 text-red-700' },
}

// Scenario 72 Part 3 — a transfer is Pending until its clearing date has
// arrived, then Cleared; a voided one is Void. Read off the clearing date by
// the backend; whether a bank has reconciled it is a separate line on the
// detail page.
export default function TransferStatusBadge({ status }: { status: FundTransferClearingStatus }) {
  const { label, className } = STYLES[status]
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${className}`}>{label}</span>
}
