'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { getTransfers } from '@/src/app/(app)/(dashboard)/inventory/transfers/_actions/get-transfers'
import {
  StatusChip,
  branchLabel,
} from '@/src/app/(app)/(dashboard)/inventory/transfers/_components/transferStatus'
import { MONO } from '@/src/app/(app)/(dashboard)/inventory/purchase-orders/_components/procurementTokens'
import { formatShortDate } from '@/src/libs/format/date'
import { STALE } from '@/src/libs/query/stale-times'
import type { TransferStatus, TransferSummary } from '@/src/schema/inventory/transfers'

// Recent enough to cover every open transfer of one item in practice; the
// list is newest-first and open ones are, by nature, the recent ones.
const FETCH_LIMIT = 100

// Transfers that haven't finished moving stock. A received, cancelled or
// rejected transfer is either already in the ledger below (as Transfer
// In/Out rows) or never moved anything.
const OPEN_STATUSES = new Set<TransferStatus>([
  'pending_manager_approval',
  'requested',
  'pending_hq_approval',
  'draft',
  'in_transit',
  'partially_received',
])

/**
 * Scenario 56 — the one part of an item's transfer story the Movements
 * ledger can't tell: transfers still requested, awaiting approval or on the
 * road. Renders nothing when there are none, so Movements stays as it was.
 */
export default function OpenTransfersSection({ itemId }: { itemId: string }) {
  const query = useQuery({
    queryKey: ['inventory-item-360', itemId, 'open-transfers'],
    queryFn: () => getTransfers({ itemId, limit: FETCH_LIMIT }),
    staleTime: STALE.REALTIME,
  })
  const all = query.data?.success ? (query.data.data?.data ?? []) : []
  const open = all.filter((t) => OPEN_STATUSES.has(t.status))
  if (open.length === 0) return null

  return (
    <div className="space-y-1.5" data-testid="open-transfers">
      <p
        className={`${MONO} text-[10.5px] font-semibold tracking-[.08em] text-[#8b8b9b] uppercase`}
      >
        Open transfers · {open.length}
      </p>
      <div className="flex flex-col gap-1.5">
        {open.map((t) => (
          <OpenTransferRow key={t.id} transfer={t} itemId={itemId} />
        ))}
      </div>
    </div>
  )
}

function OpenTransferRow({
  transfer,
  itemId,
}: {
  transfer: TransferSummary
  itemId: string
}): React.ReactElement {
  const lines = (transfer.lines ?? []).filter((l) => (l.itemId ?? l.item?.id) === itemId)
  const qty = lines.reduce((s, l) => s + Number(l.quantity), 0)
  const serials = lines.map((l) => l.serialNumber?.serialNumber).filter(Boolean)
  const number = transfer.transferNumber ?? '—'
  return (
    <Link
      href={`/inventory/transfers?transfer=${encodeURIComponent(number)}`}
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-[#e4e4e9] bg-[#fbfbfc] px-3 py-2 text-[12px] hover:border-[#d3d3db]"
    >
      <span className={`${MONO} font-semibold text-[#17171c]`}>{number}</span>
      <StatusChip status={transfer.status} />
      <span className="flex items-center gap-1 text-[#3d3d4a]">
        {branchLabel(transfer.fromWarehouse)}
        <ArrowRight className="h-3 w-3 text-[#a3a3b2]" />
        {branchLabel(transfer.toWarehouse)}
      </span>
      <span className="text-[#5b5b6b]">
        <span className={`${MONO} font-medium text-[#17171c]`}>{qty}</span>{' '}
        {qty === 1 ? 'unit' : 'units'}
        {serials.length > 0 && <span className={MONO}> · {serials.join(', ')}</span>}
      </span>
      <span className="ml-auto text-[11px] text-[#8b8b9b]">
        {transfer.transferDate ? formatShortDate(transfer.transferDate) : ''}
      </span>
    </Link>
  )
}
