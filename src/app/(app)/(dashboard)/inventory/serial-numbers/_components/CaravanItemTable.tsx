'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  CalendarClock,
  ChevronRight,
  Package,
  Send,
} from 'lucide-react'
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
import {
  caravanCountdown,
  caravanDaysLeft,
  isCaravanEnded,
  type WarehouseBranch,
} from '@/src/schema/inventory/warehouses'
import Tooltip from '@/src/components/ui/Tooltip'
import { RowActionsMenu, type RowMenuItem } from '@/src/components/ui/RowActionsMenu'
import { displayClassificationLabel } from '@/src/libs/format/text'
import SerialLink from '@/src/components/inventory/serial-history/SerialLink'
import CopySerialButton from './CopySerialButton'
import { caravanLabelWithPlace } from '@/src/libs/format/locationLabel'
import CloseCaravanButton from '@/src/components/inventory/caravan/CloseCaravanButton'

type GroupSerials = { serials: SerialNumberSummary[]; isLoading: boolean }

type Props = {
  groups: CaravanItemGroup[]
  // Running caravans with nothing on hand — a heading with no item rows.
  emptyCaravans: (WarehouseBranch & { warehouseId: string | null })[]
  // inventory:transfers:create — the "Transfer out" action opens a transfer.
  canTransfer: boolean
  // inventory:caravan:manage — each caravan heading carries its Close action.
  canClose: boolean
  isGroupOpen: (key: string) => boolean
  onToggleGroup: (key: string) => void
  groupSerials: (key: string) => GroupSerials
  emptyLabel: string
}

const COLUMN_COUNT = 1

function itemLabel(item: CaravanItemGroup['item']): string {
  if (!item) return 'Unknown item'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

function caravanDateRange(branch: WarehouseBranch | null | undefined): string {
  if (!branch?.startDate || !branch.endDate) return '—'
  return `${formatShortDate(branch.startDate)} – ${formatShortDate(branch.endDate)}`
}

// Ended needs action now; the last few days are a heads-up.
function countdownTone(branch: WarehouseBranch | null | undefined): string {
  if (isCaravanEnded(branch)) return 'text-[#b42318]'
  const days = caravanDaysLeft(branch?.endDate)
  return days !== null && days <= 3 ? 'text-[#8a4b06]' : 'text-[#3f1490]'
}

/** "3 days left" / "Ended 2 days ago" — replaces the old countdown cards. */
function CaravanCountdown({
  branch,
}: {
  branch: WarehouseBranch | null | undefined
}): React.ReactElement | null {
  if (!branch?.endDate) return null
  const Icon = isCaravanEnded(branch) ? AlertTriangle : CalendarClock
  return (
    <div
      className={`mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium ${countdownTone(branch)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {caravanCountdown(branch.endDate, branch.closedAt)}
    </div>
  )
}

type CaravanBlock = {
  key: string
  caravan: WarehouseBranch | null
  warehouseId: string | null
  groups: CaravanItemGroup[]
}

/** Rows arrive with each caravan's items together (the backend sorts them
 * so); fold consecutive rows of one caravan under one heading. */
function byCaravan(groups: CaravanItemGroup[]): CaravanBlock[] {
  const blocks: CaravanBlock[] = []
  for (const group of groups) {
    const key = group.caravan?.id ?? group.warehouseId ?? ''
    const last = blocks[blocks.length - 1]
    if (last?.key === key) last.groups.push(group)
    else
      blocks.push({
        key,
        caravan: group.caravan ?? null,
        warehouseId: group.warehouseId ?? null,
        groups: [group],
      })
  }
  return blocks
}

type Receipt = CaravanItemGroup['receipts'][number]

/** Every receiving report that stocked the caravan, newest first — usually
 * one, more once it has been restocked. */
function blockReceipts(block: CaravanBlock): Receipt[] {
  const byId = new Map<string, Receipt>()
  block.groups.forEach((g) => g.receipts.forEach((r) => byId.set(r.id, r)))
  return [...byId.values()].sort((a, b) => (b.receivedAt ?? '').localeCompare(a.receivedAt ?? ''))
}

function ReceiptLink({ receipt }: { receipt: Receipt }): React.ReactElement {
  return (
    <Link
      href={`/inventory/stock/reports/${receipt.id}`}
      onClick={(e) => e.stopPropagation()}
      className={`${MONO} text-[#5b21b6] hover:underline`}
    >
      {receipt.code}
    </Link>
  )
}

/** The heading's delivery line: "RR-… · ST TRF-… · in Oct 13", per receipt. */
function CaravanReceipts({ receipts }: { receipts: Receipt[] }): React.ReactElement | null {
  if (receipts.length === 0) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-[#8b8b9b]">
      {receipts.map((r) => (
        <span key={r.id}>
          <ReceiptLink receipt={r} />
          {r.transferNumber && <span className={MONO}> · ST {r.transferNumber}</span>}
          {r.receivedAt && <> · in {formatShortDate(r.receivedAt)}</>}
        </span>
      ))}
    </div>
  )
}

function onHandOf(group: CaravanItemGroup): number {
  return (group.statusCounts?.in_stock ?? 0) + (group.statusCounts?.held ?? 0)
}

/**
 * Scenario 60 — one caravan's heading over its items: which caravan (event,
 * where it is set up, when), the host branch whose books and POS it belongs
 * to, and what is on hand there. An ended caravan is flagged, since whatever
 * is still in it has to be transferred out.
 */
const HEADER_LINK =
  'inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-[#d3d3db] bg-white px-2.5 py-1 text-[12px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb]'

/** New-transfer choices for one caravan: into it while it is still running
 * (an ended caravan takes no new stock), and out of it at any time. */
function transferMenuItems(
  caravan: WarehouseBranch | null,
  warehouseId: string,
  go: (href: string) => void
): RowMenuItem[] {
  const base = '/inventory/stock-transaction?tab=transfers'
  return [
    ...(isCaravanEnded(caravan)
      ? []
      : [
          {
            label: 'Transfer in — to this caravan',
            icon: ArrowDownToLine,
            onClick: () => go(`${base}&prefillToWarehouseId=${warehouseId}`),
          },
        ]),
    {
      label: 'Transfer out — from this caravan',
      icon: ArrowUpFromLine,
      onClick: () => go(`${base}&prefillFromWarehouseId=${warehouseId}`),
    },
  ]
}

/** Stock Transfer for one caravan: its transfers, and a new one either way. */
function CaravanTransferLinks({
  caravan,
  warehouseId,
  canTransfer,
}: {
  caravan: WarehouseBranch | null
  warehouseId: string | null
  canTransfer: boolean
}): React.ReactElement | null {
  const router = useRouter()
  if (!warehouseId) return null
  const base = '/inventory/stock-transaction?tab=transfers'
  return (
    <>
      <Tooltip label="Stock transfers into and out of this caravan">
        <Link href={`${base}&warehouseId=${warehouseId}`} className={HEADER_LINK}>
          <ArrowRightLeft className="h-3.5 w-3.5" />
          View transfers
        </Link>
      </Tooltip>
      {canTransfer && (
        <RowActionsMenu
          trigger={{ label: 'Transfer', icon: Send, className: HEADER_LINK }}
          items={transferMenuItems(caravan, warehouseId, router.push)}
        />
      )}
    </>
  )
}

function CaravanHeaderRow({
  block,
  canClose,
  canTransfer,
}: {
  block: CaravanBlock
  canClose: boolean
  canTransfer: boolean
}): React.ReactElement {
  const { caravan } = block
  const onHand = block.groups.reduce((n, g) => n + onHandOf(g), 0)
  return (
    <tr className="border-t-2 border-[#e4e4e9] bg-[#f8f6fc]">
      <td colSpan={COLUMN_COUNT} className="px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-[#17171c]">
              {caravan ? caravanLabelWithPlace(caravan) : 'Unknown caravan'}
              {caravan?.hostBranch && (
                <span className="font-normal text-[#5b5b6b]"> at {caravan.hostBranch.name}</span>
              )}
            </div>
            <div className="text-[12px] text-[#8b8b9b]">
              {caravanDateRange(caravan)}
              {' · '}
              {onHand.toLocaleString()} on hand
            </div>
            <CaravanReceipts receipts={blockReceipts(block)} />
            <CaravanCountdown branch={caravan} />
            {block.groups.length > 0 && (
              <div className="mt-1.5">
                <StatusBadges counts={blockStatusCounts(block)} />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <CaravanTransferLinks
              caravan={caravan}
              warehouseId={block.warehouseId}
              canTransfer={canTransfer}
            />
            {canClose && <CloseCaravanButton caravan={caravan} />}
          </div>
        </div>
      </td>
    </tr>
  )
}

// Ordered by the status enum rather than by count, so the same item's
// breakdown reads the same way from one row to the next.
function orderedStatusCounts(
  counts: Record<string, number> | undefined
): Array<[SerialStatus, number]> {
  return SerialStatusSchema.options
    .map((status) => [status, counts?.[status] ?? 0] as [SerialStatus, number])
    .filter(([, count]) => count > 0)
}

/** Every item's status counts at one caravan, added up — for its heading. */
function blockStatusCounts(block: CaravanBlock): Record<string, number> {
  const totals: Record<string, number> = {}
  block.groups.forEach((g) =>
    Object.entries(g.statusCounts ?? {}).forEach(([status, n]) => {
      totals[status] = (totals[status] ?? 0) + n
    })
  )
  return totals
}

function StatusBadges({
  counts,
}: {
  counts: Record<string, number> | undefined
}): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1">
      {orderedStatusCounts(counts).map(([status, count]) => (
        <StatusBadge
          key={status}
          label={`${SERIAL_STATUS_LABELS[status]} ${count}`}
          colorClassName={SERIAL_STATUS_COLORS[status]}
          dotClassName={SERIAL_STATUS_DOT_COLORS[status]}
          size="xs"
        />
      ))}
    </div>
  )
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
  showReceipt,
}: {
  group: CaravanItemGroup
  isExpanded: boolean
  onToggle: () => void
  // The caravan's heading lists its receipts; a row names its own only when
  // the caravan was stocked more than once, to say which delivery it was.
  showReceipt: boolean
}): React.ReactElement {
  // Sold units keep the caravan as their warehouse, so the group's raw
  // quantity counts history too — only these are actually there.
  const onHand = onHandOf(group)

  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer hover:bg-[#fcfcfd] ${isExpanded ? 'bg-[#f8f4fd]' : ''}`}
    >
      <td className="px-4 py-[11px]">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
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
              {showReceipt && group.receipts.length > 0 && (
                <span className="text-[11px] text-[#8b8b9b]">
                  From{' '}
                  {group.receipts.map((r, i) => (
                    <Fragment key={r.id}>
                      {i > 0 && ', '}
                      <ReceiptLink receipt={r} />
                    </Fragment>
                  ))}
                </span>
              )}
            </div>
          </div>
          {/* This item's own share of the heading's totals. */}
          <div className="flex flex-wrap items-center gap-3">
            <span className={`${MONO} text-[12.5px] text-[#5b5b6b]`}>
              <span className="font-semibold text-[#17171c]">{onHand.toLocaleString()}</span> on
              hand
            </span>
            <StatusBadges counts={group.statusCounts} />
          </div>
        </div>
      </td>
    </tr>
  )
}

function StatusPill({ status }: { status: SerialStatus }): React.ReactElement {
  return (
    <StatusBadge
      label={SERIAL_STATUS_LABELS[status]}
      colorClassName={SERIAL_STATUS_COLORS[status]}
      dotClassName={SERIAL_STATUS_DOT_COLORS[status]}
      size="xs"
    />
  )
}

/** One unit inside an opened item row — receipt and date live on the
 * caravan's heading. */
function UnitRow({ serial }: { serial: SerialNumberSummary }): React.ReactElement {
  const type = displayClassificationLabel(serial.item?.type?.name)
  return (
    <tr>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <SerialLink
            serialId={serial.id}
            serialNumber={serial.serialNumber}
            className={`${MONO} text-[13.5px] font-semibold text-[#17171c]`}
          />
          <CopySerialButton serialNumber={serial.serialNumber} />
        </div>
        {type && <span className="text-[12px] text-[#8b8b9b]">{type}</span>}
      </td>
      <td className="py-2 text-right">
        <StatusPill status={serial.status} />
      </td>
    </tr>
  )
}

function OpenedUnits({ serials, isLoading }: GroupSerials): React.ReactElement {
  return (
    <tr className="bg-[#fbfbfc]">
      <td colSpan={COLUMN_COUNT} className="py-2 pl-10 pr-4">
        {isLoading ? (
          <div className="flex flex-col gap-2 py-1">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-3.5 w-48 animate-pulse rounded bg-[#eeeef1]" />
            ))}
          </div>
        ) : serials.length === 0 ? (
          <p className="py-1 text-[12px] text-[#8b8b9b]">No units to show for this item.</p>
        ) : (
          <table className="w-full max-w-[520px]">
            <thead>
              <tr
                className={`${MONO} text-left text-[10px] uppercase tracking-[.09em] text-[#8b8b9b]`}
              >
                <th className="py-1.5 pr-4 font-normal">Serial #</th>
                <th className="py-1.5 text-right font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eeeef1]">
              {serials.map((serial) => (
                <UnitRow key={serial.id} serial={serial} />
              ))}
            </tbody>
          </table>
        )}
      </td>
    </tr>
  )
}

// Scenario 60 — the Caravan tab: each caravan's heading with a row per item
// beneath it, each opening onto its units. Quantities come from the backend rollup, so they count every
// unit rather than the page on screen.
export default function CaravanItemTable({
  groups,
  emptyCaravans,
  canTransfer,
  canClose,
  isGroupOpen,
  onToggleGroup,
  groupSerials,
  emptyLabel,
}: Props): React.ReactElement {
  if (groups.length === 0 && emptyCaravans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
        <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
        <div className="mt-1 text-[14px] font-semibold">{emptyLabel}</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y divide-[#f4f4f6]">
          {byCaravan(groups).map((block) => (
            <Fragment key={block.key}>
              <CaravanHeaderRow block={block} canClose={canClose} canTransfer={canTransfer} />
              {block.groups.map((group) => (
                <Fragment key={group.key}>
                  <GroupRow
                    group={group}
                    isExpanded={isGroupOpen(group.key)}
                    onToggle={() => onToggleGroup(group.key)}
                    showReceipt={blockReceipts(block).length > 1}
                  />
                  {isGroupOpen(group.key) && <OpenedUnits {...groupSerials(group.key)} />}
                </Fragment>
              ))}
            </Fragment>
          ))}
          {emptyCaravans.map((caravan) => (
            <Fragment key={caravan.id}>
              <CaravanHeaderRow
                block={{ key: caravan.id, caravan, warehouseId: caravan.warehouseId, groups: [] }}
                canClose={canClose}
                canTransfer={canTransfer}
              />
              <tr>
                <td colSpan={COLUMN_COUNT} className="px-4 py-3 text-[12.5px] text-[#8b8b9b]">
                  Nothing on hand at this caravan yet.
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
