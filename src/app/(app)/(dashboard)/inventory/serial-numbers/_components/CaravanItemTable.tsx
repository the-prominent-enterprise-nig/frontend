'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { ArrowRightLeft, ChevronRight, Package } from 'lucide-react'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { MONO } from '../../purchase-orders/_components/procurementTokens'
import { formatShortDate } from '@/src/libs/format/date'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SERIAL_STATUS_DOT_COLORS,
  SerialStatusSchema,
  type CaravanItemGroup,
  type SerialNumberSummary,
  type SerialStatus,
} from '@/src/schema/inventory/serial-numbers'
import { isCaravanEnded, type WarehouseBranch } from '@/src/schema/inventory/warehouses'
import Tooltip from '@/src/components/ui/Tooltip'

type Props = {
  groups: CaravanItemGroup[]
  // inventory:transfers:create — the "Transfer out" action opens a transfer.
  canTransfer: boolean
  expandedGroupKey: string | null
  onToggleGroup: (key: string) => void
  expandedSerials: SerialNumberSummary[]
  isLoadingExpandedSerials: boolean
}

const COLUMN_COUNT = 7

function itemLabel(item: CaravanItemGroup['item']): string {
  if (!item) return 'Unknown item'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

function caravanDateRange(branch: WarehouseBranch | null | undefined): string {
  if (!branch?.startDate || !branch.endDate) return '—'
  return `${formatShortDate(branch.startDate)} – ${formatShortDate(branch.endDate)}`
}

/**
 * Scenario 60 — the two caravan columns shared by the Caravan tab's serial
 * list and this rollup: which caravan (event, where it is set up, when) and
 * the host branch whose books and POS it belongs to. An ended caravan is
 * flagged, since whatever is still in it has to be transferred out.
 */
export function CaravanCells({
  branch,
}: {
  branch: WarehouseBranch | null | undefined
}): React.ReactElement {
  const ended = isCaravanEnded(branch)
  return (
    <>
      <td className="px-4 py-[11px] text-[13.5px]">
        <div className="flex flex-wrap items-center gap-1.5 font-medium text-[#17171c]">
          {branch?.eventName ?? branch?.name ?? '—'}
          {ended && (
            <span className="rounded-full bg-[#fdeceb] px-2 py-0.5 text-[11px] font-medium text-[#b42318]">
              Ended
            </span>
          )}
        </div>
        {branch?.addressLine1 && (
          <div className="text-[12.5px] text-[#5b5b6b]">{branch.addressLine1}</div>
        )}
        <div className="text-[12px] text-[#8b8b9b]">{caravanDateRange(branch)}</div>
      </td>
      <td className="px-4 py-[11px] text-[13.5px] text-[#5b5b6b]">
        {branch?.hostBranch?.name ?? '—'}
      </td>
    </>
  )
}

/** Opens New Stock Transfer with this caravan as the source and the item
 * filled in — the destination (host, any branch, another caravan) is
 * chosen there. Which units ship is decided at dispatch, as for any transfer. */
export function TransferOutLink({
  fromWarehouseId,
  itemId,
  itemLabel,
  quantity,
}: {
  fromWarehouseId: string
  itemId?: string
  itemLabel?: string
  quantity: number
}): React.ReactElement | null {
  if (!itemId || quantity < 1) return null
  const params = new URLSearchParams({
    prefillFromWarehouseId: fromWarehouseId,
    prefillItemId: itemId,
    prefillQty: String(quantity),
    ...(itemLabel && { prefillItemLabel: itemLabel }),
  })
  return (
    <Tooltip label="Transfer to the host branch, another branch or another caravan">
      <Link
        href={`/inventory/transfers?${params.toString()}`}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1 text-[12px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb]"
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Transfer out
      </Link>
    </Tooltip>
  )
}

// Ordered by the status enum rather than by count, so the same item's
// breakdown reads the same way from one row to the next.
function orderedStatusCounts(group: CaravanItemGroup): Array<[SerialStatus, number]> {
  return SerialStatusSchema.options
    .map((status) => [status, group.statusCounts?.[status] ?? 0] as [SerialStatus, number])
    .filter(([, count]) => count > 0)
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
  canTransfer,
}: {
  group: CaravanItemGroup
  isExpanded: boolean
  onToggle: () => void
  canTransfer: boolean
}): React.ReactElement {
  const inStock = group.statusCounts?.in_stock ?? 0

  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer hover:bg-[#fcfcfd] ${isExpanded ? 'bg-[#f8f4fd]' : ''}`}
    >
      <td className="px-4 py-[11px]">
        <div className="flex items-center gap-2">
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-[#8b8b9b] transition-transform ${
              isExpanded ? 'rotate-90' : ''
            }`}
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[12.5px] font-medium text-[#17171c]">
              {itemLabel(group.item)}
            </span>
            {group.item?.sku && (
              <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>{group.item.sku}</span>
            )}
          </div>
        </div>
      </td>
      <td className={`${MONO} px-4 py-[11px] text-right text-[13px] font-semibold text-[#17171c]`}>
        {group.quantity.toLocaleString()}
      </td>
      <CaravanCells branch={group.caravan} />
      <td className="px-4 py-[11px]">
        <div className="flex flex-wrap justify-center gap-1">
          {orderedStatusCounts(group).map(([status, count]) => (
            <StatusBadge
              key={status}
              label={`${SERIAL_STATUS_LABELS[status]} ${count}`}
              colorClassName={SERIAL_STATUS_COLORS[status]}
              dotClassName={SERIAL_STATUS_DOT_COLORS[status]}
              size="xs"
            />
          ))}
        </div>
      </td>
      <td className="px-4 py-[11px] text-right">
        {canTransfer && group.warehouseId && (
          <TransferOutLink
            fromWarehouseId={group.warehouseId}
            itemId={group.item?.id}
            itemLabel={group.item?.name}
            quantity={inStock}
          />
        )}
      </td>
    </tr>
  )
}

function ExpandedSerials({
  serials,
  isLoading,
}: {
  serials: SerialNumberSummary[]
  isLoading: boolean
}): React.ReactElement {
  return (
    <tr className="bg-[#fbfbfc]">
      <td colSpan={COLUMN_COUNT} className="px-4 py-3">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3.5 w-48 animate-pulse rounded bg-[#eeeef1]" />
            ))}
          </div>
        ) : serials.length === 0 ? (
          <p className="text-[12px] text-[#8b8b9b]">No units to show for this group.</p>
        ) : (
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {serials.map((serial) => (
              <div key={serial.id} className="flex items-center gap-2">
                <span className={`${MONO} text-[12px] font-medium text-[#17171c]`}>
                  {serial.serialNumber}
                </span>
                <StatusBadge
                  label={SERIAL_STATUS_LABELS[serial.status]}
                  colorClassName={SERIAL_STATUS_COLORS[serial.status]}
                  dotClassName={SERIAL_STATUS_DOT_COLORS[serial.status]}
                  size="xs"
                />
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  )
}

// Scenario 60 — the Caravan tab's "By Item" view: one row per item per
// caravan. Quantities come from the backend rollup, so they count every unit
// rather than the page on screen; expanding a row lists its serials.
export default function CaravanItemTable({
  groups,
  canTransfer,
  expandedGroupKey,
  onToggleGroup,
  expandedSerials,
  isLoadingExpandedSerials,
}: Props): React.ReactElement {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
        <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
        <div className="mt-1 text-[14px] font-semibold">Nothing currently out on caravan</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
          >
            <th className="px-4 py-[9px] text-left">Item</th>
            <th className="px-4 py-[9px] text-right">Qty</th>
            <th className="px-4 py-[9px] text-left">Caravan</th>
            <th className="px-4 py-[9px] text-left">Host branch</th>
            <th className="px-4 py-[9px] text-center">Units by status</th>
            <th className="px-4 py-[9px] text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f4f4f6]">
          {groups.map((group) => (
            <Fragment key={group.key}>
              <GroupRow
                group={group}
                isExpanded={expandedGroupKey === group.key}
                onToggle={() => onToggleGroup(group.key)}
                canTransfer={canTransfer}
              />
              {expandedGroupKey === group.key && (
                <ExpandedSerials serials={expandedSerials} isLoading={isLoadingExpandedSerials} />
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
