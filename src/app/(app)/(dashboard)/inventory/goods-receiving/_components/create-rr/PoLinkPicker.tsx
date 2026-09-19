'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, PackageSearch, Search, X } from 'lucide-react'
import { STALE } from '@/src/libs/query/stale-times'
import { locationLabel } from '@/src/libs/format/locationLabel'
import type { PurchaseOrderSummary } from '@/src/schema/inventory/purchase-orders'
import { getPurchaseOrders } from '../../../purchase-orders/_actions/get-purchase-orders'
import { MONO, STATUS_META } from '../../../purchase-orders/_components/procurementTokens'
import { INPUT } from './rrTokens'

type Props = {
  /** Narrows the list to one supplier once the form already knows who
   * delivered. Left open when it does not — a receiver who reaches for the PO
   * first is telling us the supplier, not the other way round. */
  supplierId?: string
  supplierName?: string
  onPick: (po: PurchaseOrderSummary) => void
  onClose: () => void
}

/** A PO is still expecting goods while any line has units outstanding. */
export function outstandingOf(po: PurchaseOrderSummary): number {
  return po.lines.reduce(
    (sum, line) => sum + Math.max(Number(line.quantity) - Number(line.receivedQuantity ?? 0), 0),
    0
  )
}

const OPEN_STATUSES: PurchaseOrderSummary['status'][] = ['approved', 'sent', 'partially_received']

/**
 * Picks the purchase order this delivery is against.
 *
 * Linking is what turns a typed-in PO number into a real reference: the lines
 * pulled from it carry `purchaseOrderLineId`, so posting the receipt moves the
 * PO's own received quantities instead of leaving it open forever with a
 * matching receipt sitting beside it that nothing joins up.
 */
export function PoLinkPicker({
  supplierId,
  supplierName,
  onPick,
  onClose,
}: Props): React.ReactElement {
  const [query, setQuery] = useState('')

  const posQuery = useQuery({
    queryKey: ['rr-po-link', supplierId ?? 'all', query],
    queryFn: () =>
      getPurchaseOrders({
        limit: 30,
        supplierId: supplierId || undefined,
        search: query.trim() || undefined,
        sortDir: 'desc',
      }),
    staleTime: STALE.LOOKUP,
  })

  const orders = (posQuery.data?.data?.data ?? []).filter(
    (po) => OPEN_STATUSES.includes(po.status) && outstandingOf(po) > 0
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Link a purchase order"
      onClick={onClose}
      className="absolute inset-0 z-[60] flex items-start justify-center bg-[#17171c]/40 px-4 py-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-[#e4e4e9] bg-white shadow-[0_30px_70px_-30px_rgba(10,4,26,.5)]"
      >
        <div className="flex items-start justify-between gap-3.5 border-b border-[#eeeef1] px-4.5 py-3.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[15px] font-semibold tracking-[-.01em]">
              Link a purchase order
            </span>
            <span className="text-[11.5px] leading-[1.45] text-[#8b8b9b]">
              {supplierName
                ? `Open orders for ${supplierName}.`
                : 'Linking a PO fills in the supplier and lets you pull its outstanding lines.'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8b8b9b] hover:bg-[#f1f1f4] hover:text-[#17171c]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-[#eeeef1] px-4.5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#a3a3b2]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="text"
              placeholder="Search by PO number or supplier…"
              aria-label="Search purchase orders"
              className={`${INPUT} pl-9`}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4.5 py-3.5">
          {posQuery.isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-[12.5px] text-[#8b8b9b]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading open purchase orders…
            </div>
          )}

          {!posQuery.isLoading &&
            orders.map((po) => {
              const outstanding = outstandingOf(po)
              const meta = STATUS_META[po.status]
              return (
                <button
                  key={po.id}
                  type="button"
                  onClick={() => onPick(po)}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e4e4e9] bg-white px-3 py-2.5 text-left hover:border-[#ddd0f7] hover:bg-[#fcfaff]"
                >
                  <div className="flex min-w-0 flex-col gap-[3px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`${MONO} text-[12.5px] font-semibold`}>{po.code}</span>
                      <span
                        className={`rounded-[5px] px-2 py-0.5 text-[11px] font-medium ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-[12px] text-[#3d3d4a]">{po.supplier.name}</span>
                    <span className="text-[11px] text-[#8b8b9b]">
                      {outstanding} {outstanding === 1 ? 'unit' : 'units'} outstanding
                      {po.warehouse ? ` · to ${locationLabel(po.warehouse)}` : ''}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-[7px] bg-[#f1ebfb] px-[11px] py-1.5 text-[11.5px] font-medium text-[#3f1490]">
                    Link
                  </span>
                </button>
              )
            })}

          {!posQuery.isLoading && orders.length === 0 && (
            <div className="flex flex-col items-center gap-1.5 py-9 text-center">
              <PackageSearch className="h-5 w-5 text-[#d3d3db]" />
              <span className="text-[12.5px] text-[#5b5b6b]">
                {query.trim()
                  ? `Nothing open matches “${query.trim()}”.`
                  : supplierName
                    ? `No open purchase orders for ${supplierName}.`
                    : 'No purchase orders are waiting on a delivery.'}
              </span>
              <span className="max-w-[360px] text-[11.5px] leading-[1.5] text-[#8b8b9b]">
                A receipt does not need a PO. Close this and record the delivery directly.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
