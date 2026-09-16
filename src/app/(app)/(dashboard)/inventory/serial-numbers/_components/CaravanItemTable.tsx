'use client'

import { Fragment } from 'react'
import { ChevronRight, Package } from 'lucide-react'
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

type Props = {
  groups: CaravanItemGroup[]
  // Whether the list is narrowed to one branch — only the wording of the
  // empty state differs, so it stays a plain boolean rather than the branch.
  isBranchScoped: boolean
  expandedGroupKey: string | null
  onToggleGroup: (key: string) => void
  expandedSerials: SerialNumberSummary[]
  isLoadingExpandedSerials: boolean
}

const COLUMN_COUNT = 5

function itemLabel(item: CaravanItemGroup['item']): string {
  if (!item) return 'Unknown item'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

// A group is always at exactly one of the two: a host branch that may sell it,
// or an outside venue where ownership never moved.
function destinationLabel(group: CaravanItemGroup): string {
  return group.consignedToBranch?.name ?? group.consignedToVenue ?? '—'
}

function eventDateRange(group: CaravanItemGroup): string | null {
  if (!group.caravanEventStartDate && !group.caravanEventEndDate) return null
  const start = group.caravanEventStartDate ? formatShortDate(group.caravanEventStartDate) : '—'
  const end = group.caravanEventEndDate ? formatShortDate(group.caravanEventEndDate) : '—'
  return `${start} – ${end}`
}

// Ordered by the status enum rather than by count, so the same item's
// breakdown reads the same way from one row to the next.
function orderedStatusCounts(group: CaravanItemGroup): Array<[SerialStatus, number]> {
  return SerialStatusSchema.options
    .map((status) => [status, group.statusCounts[status] ?? 0] as [SerialStatus, number])
    .filter(([, count]) => count > 0)
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: CaravanItemGroup
  isExpanded: boolean
  onToggle: () => void
}): React.ReactElement {
  const dateRange = eventDateRange(group)

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
      <td className="px-4 py-[11px]">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fdf3e7] px-2.5 py-0.5 text-[11px] font-medium text-[#8a4b06]">
          {destinationLabel(group)}
        </span>
      </td>
      <td className="px-4 py-[11px] text-[12.5px] text-[#5b5b6b] hidden md:table-cell">
        <div>{group.caravanEventName ?? '—'}</div>
        {dateRange && <div className="text-[11px] text-[#8b8b9b]">{dateRange}</div>}
      </td>
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

// Scenario 08 (Caravan) — the "By Item" view. Quantities come from the backend
// rollup, so they count every consigned unit rather than the page on screen;
// expanding a row lists that group's individual serials.
export default function CaravanItemTable({
  groups,
  isBranchScoped,
  expandedGroupKey,
  onToggleGroup,
  expandedSerials,
  isLoadingExpandedSerials,
}: Props): React.ReactElement {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
        <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
        <div className="mt-1 text-[14px] font-semibold">
          {isBranchScoped
            ? 'Nothing currently consigned to this branch'
            : 'Nothing currently out on caravan'}
        </div>
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
            <th className="px-4 py-[9px] text-left">Host / Venue</th>
            <th className="px-4 py-[9px] text-left hidden md:table-cell">Event</th>
            <th className="px-4 py-[9px] text-center">Units by status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f4f4f6]">
          {groups.map((group) => (
            <Fragment key={group.key}>
              <GroupRow
                group={group}
                isExpanded={expandedGroupKey === group.key}
                onToggle={() => onToggleGroup(group.key)}
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
