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
  CalendarDays,
  ChevronRight,
  MapPin,
  Package,
  Send,
  Truck,
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
  // Running caravans with nothing on hand — a card with no item rows.
  emptyCaravans: (WarehouseBranch & { warehouseId: string | null })[]
  // inventory:transfers:create — the "Transfer out" action opens a transfer.
  canTransfer: boolean
  // inventory:caravan:manage — each caravan card carries its Close action.
  canClose: boolean
  isGroupOpen: (key: string) => boolean
  onToggleGroup: (key: string) => void
  groupSerials: (key: string) => GroupSerials
  emptyLabel: string
}

const COLUMN_LABEL = `${MONO} text-[10px] font-normal uppercase tracking-[.09em] text-[#8b8b9b]`

function itemLabel(item: CaravanItemGroup['item']): string {
  if (!item) return 'Unknown item'
  const parts = [item.brand?.name, item.modelNumber].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : item.name
}

function caravanDateRange(branch: WarehouseBranch | null | undefined): string | null {
  if (!branch?.startDate || !branch.endDate) return null
  return `${formatShortDate(branch.startDate)} – ${formatShortDate(branch.endDate)}`
}

// Ended needs action now; the last few days are a heads-up.
function countdownTone(branch: WarehouseBranch | null | undefined): string {
  if (isCaravanEnded(branch)) return 'bg-[#fdeceb] text-[#b42318]'
  const days = caravanDaysLeft(branch?.endDate)
  return days !== null && days <= 3 ? 'bg-[#fef4e6] text-[#8a4b06]' : 'bg-[#f1ebfb] text-[#3f1490]'
}

/** "3 days left" / "Ended 2 days ago" as a pill beside the caravan's name. */
function CaravanCountdown({
  branch,
}: {
  branch: WarehouseBranch | null | undefined
}): React.ReactElement | null {
  if (!branch?.endDate) return null
  const Icon = isCaravanEnded(branch) ? AlertTriangle : CalendarClock
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium ${countdownTone(branch)}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {caravanCountdown(branch.endDate, branch.closedAt)}
    </span>
  )
}

type CaravanBlock = {
  key: string
  caravan: WarehouseBranch | null
  warehouseId: string | null
  groups: CaravanItemGroup[]
}

/** Rows arrive with each caravan's items together (the backend sorts them
 * so); fold consecutive rows of one caravan into one card. */
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

/** One delivery into the caravan: "RR-… · ST TRF-… · Oct 13". */
function DeliveryChip({ receipt }: { receipt: Receipt }): React.ReactElement {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 rounded-md border border-[#ececf1] bg-white px-2 py-1 text-[11.5px] text-[#5b5b6b]">
      <ReceiptLink receipt={receipt} />
      {receipt.transferNumber && (
        <span className={`${MONO} text-[#8b8b9b]`}>ST {receipt.transferNumber}</span>
      )}
      {receipt.receivedAt && (
        <span className="text-[#8b8b9b]">in {formatShortDate(receipt.receivedAt)}</span>
      )}
    </span>
  )
}

function CaravanDeliveries({ receipts }: { receipts: Receipt[] }): React.ReactElement | null {
  if (receipts.length === 0) return null
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <span className={`${COLUMN_LABEL} inline-flex items-center gap-1`}>
        <Truck className="h-3.5 w-3.5" />
        {receipts.length === 1 ? 'Delivery' : `Deliveries (${receipts.length})`}
      </span>
      {receipts.map((r) => (
        <DeliveryChip key={r.id} receipt={r} />
      ))}
    </div>
  )
}

function onHandOf(group: CaravanItemGroup): number {
  return (group.statusCounts?.in_stock ?? 0) + (group.statusCounts?.held ?? 0)
}

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

/** Where and when: host branch, then the caravan's run. */
function CaravanWhereWhen({ caravan }: { caravan: WarehouseBranch | null }): React.ReactElement {
  const dates = caravanDateRange(caravan)
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[#5b5b6b]">
      {caravan?.hostBranch && (
        <span className="inline-flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-[#8b8b9b]" />
          Host branch: <span className="font-medium text-[#17171c]">{caravan.hostBranch.name}</span>
        </span>
      )}
      {dates && (
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5 text-[#8b8b9b]" />
          {dates}
        </span>
      )}
    </div>
  )
}

type HeaderProps = { block: CaravanBlock; canClose: boolean; canTransfer: boolean }

/**
 * Scenario 60 — one caravan's card header: which caravan (event, where it is
 * set up, when), the host branch whose books and POS it belongs to, and its
 * actions.
 */
function CaravanHeader({ block, canClose, canTransfer }: HeaderProps): React.ReactElement {
  const { caravan } = block
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pb-3 pt-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] font-semibold text-[#17171c]">
            {caravan ? caravanLabelWithPlace(caravan) : 'Unknown caravan'}
          </h3>
          <CaravanCountdown branch={caravan} />
        </div>
        <CaravanWhereWhen caravan={caravan} />
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
  )
}

/** An ended caravan with stock still in it — say plainly what to do. */
function EndedNotice({ onHand }: { onHand: number }): React.ReactElement {
  return (
    <div className="mx-5 mb-3 flex items-center gap-2 rounded-lg border border-[#f3c9c5] bg-[#fdf4f3] px-3 py-2 text-[12px] text-[#b42318]">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      This caravan has ended — transfer out the {onHand.toLocaleString()}{' '}
      {onHand === 1 ? 'unit' : 'units'} still on hand.
    </div>
  )
}

/** On hand as the headline number, then the status breakdown and deliveries. */
function CaravanSummary({
  block,
  onHand,
}: {
  block: CaravanBlock
  onHand: number
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-[#eeeef1] bg-[#faf9fc] px-5 py-2.5">
      <div className="flex items-baseline gap-1.5">
        <span className={`${MONO} text-[18px] font-semibold text-[#17171c]`}>
          {onHand.toLocaleString()}
        </span>
        <span className="text-[12px] text-[#5b5b6b]">on hand</span>
      </div>
      {block.groups.length > 0 && <StatusBadges counts={blockStatusCounts(block)} />}
      <div className="min-w-0 lg:ml-auto">
        <CaravanDeliveries receipts={blockReceipts(block)} />
      </div>
    </div>
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

/** Every item's status counts at one caravan, added up — for its summary. */
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

function GroupReceipts({ receipts }: { receipts: Receipt[] }): React.ReactElement {
  if (receipts.length === 0) return <span className="text-[#c9c9d3]">—</span>
  return (
    <span className="text-[12px]">
      {receipts.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && ', '}
          <ReceiptLink receipt={r} />
        </Fragment>
      ))}
    </span>
  )
}

function ItemCell({
  group,
  isExpanded,
}: {
  group: CaravanItemGroup
  isExpanded: boolean
}): React.ReactElement {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <ChevronRight
        className={`h-4 w-4 shrink-0 text-[#8b8b9b] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
      />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13px] font-medium text-[#17171c]">
          {itemLabel(group.item)}
        </span>
        {group.item?.sku && (
          <span className={`${MONO} text-[11px] text-[#8b8b9b]`}>{group.item.sku}</span>
        )}
      </div>
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
  // The caravan's summary lists its deliveries; rows name their own only when
  // the caravan was stocked more than once, to say which delivery it was.
  showReceipt: boolean
}): React.ReactElement {
  // Sold units keep the caravan as their warehouse, so the group's raw
  // quantity counts history too — only these are actually there.
  const onHand = onHandOf(group)
  return (
    <tr
      onClick={onToggle}
      className={`cursor-pointer hover:bg-[#fcfbfe] ${isExpanded ? 'bg-[#f8f4fd]' : ''}`}
    >
      <td className="py-3 pl-5 pr-4">
        <ItemCell group={group} isExpanded={isExpanded} />
      </td>
      {showReceipt && (
        <td className="hidden px-4 py-3 md:table-cell">
          <GroupReceipts receipts={group.receipts} />
        </td>
      )}
      <td className="px-4 py-3 text-right">
        <span
          className={`${MONO} text-[14px] font-semibold ${onHand > 0 ? 'text-[#17171c]' : 'text-[#c9c9d3]'}`}
        >
          {onHand.toLocaleString()}
        </span>
      </td>
      <td className="py-3 pl-4 pr-5">
        <StatusBadges counts={group.statusCounts} />
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
 * caravan's summary. */
function UnitRow({ serial }: { serial: SerialNumberSummary }): React.ReactElement {
  const type = displayClassificationLabel(serial.item?.type?.name)
  return (
    <tr>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <SerialLink
            serialId={serial.id}
            serialNumber={serial.serialNumber}
            className={`${MONO} text-[13px] font-semibold text-[#17171c]`}
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

function UnitsSkeleton(): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 py-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-3.5 w-48 animate-pulse rounded bg-[#eeeef1]" />
      ))}
    </div>
  )
}

function OpenedUnits({
  serials,
  isLoading,
  colSpan,
}: GroupSerials & { colSpan: number }): React.ReactElement {
  return (
    <tr className="bg-[#fbfbfc]">
      <td colSpan={colSpan} className="py-2 pl-[46px] pr-5">
        {isLoading ? (
          <UnitsSkeleton />
        ) : serials.length === 0 ? (
          <p className="py-1 text-[12px] text-[#8b8b9b]">No units to show for this item.</p>
        ) : (
          <table className="w-full max-w-[560px]">
            <thead>
              <tr className={`${COLUMN_LABEL} text-left`}>
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

function ItemTableHead({ showReceipt }: { showReceipt: boolean }): React.ReactElement {
  return (
    <thead>
      <tr className={`${COLUMN_LABEL} text-left`}>
        <th className="py-2 pl-5 pr-4 font-normal">Item</th>
        {showReceipt && (
          <th className="hidden px-4 py-2 font-normal md:table-cell">Received via</th>
        )}
        <th className="w-[96px] px-4 py-2 text-right font-normal">On hand</th>
        <th className="w-[1%] whitespace-nowrap py-2 pl-4 pr-5 font-normal">Status</th>
      </tr>
    </thead>
  )
}

type ItemsProps = Pick<Props, 'isGroupOpen' | 'onToggleGroup' | 'groupSerials'> & {
  block: CaravanBlock
}

function CaravanItems({
  block,
  isGroupOpen,
  onToggleGroup,
  groupSerials,
}: ItemsProps): React.ReactElement {
  const showReceipt = blockReceipts(block).length > 1
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <ItemTableHead showReceipt={showReceipt} />
        <tbody className="divide-y divide-[#f4f4f6] border-t border-[#f4f4f6]">
          {block.groups.map((group) => (
            <Fragment key={group.key}>
              <GroupRow
                group={group}
                isExpanded={isGroupOpen(group.key)}
                onToggle={() => onToggleGroup(group.key)}
                showReceipt={showReceipt}
              />
              {isGroupOpen(group.key) && (
                <OpenedUnits {...groupSerials(group.key)} colSpan={showReceipt ? 4 : 3} />
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type CardProps = Omit<Props, 'groups' | 'emptyCaravans' | 'emptyLabel'> & { block: CaravanBlock }

/** One caravan: header, ended notice, summary strip, then its items. */
function CaravanCard({ block, canClose, canTransfer, ...items }: CardProps): React.ReactElement {
  const onHand = block.groups.reduce((n, g) => n + onHandOf(g), 0)
  return (
    <section className="overflow-hidden rounded-xl border border-[#e4e4e9] bg-white">
      <CaravanHeader block={block} canClose={canClose} canTransfer={canTransfer} />
      {isCaravanEnded(block.caravan) && onHand > 0 && <EndedNotice onHand={onHand} />}
      <CaravanSummary block={block} onHand={onHand} />
      {block.groups.length > 0 ? (
        <CaravanItems block={block} {...items} />
      ) : (
        <p className="px-5 py-4 text-[12.5px] text-[#8b8b9b]">
          Nothing on hand at this caravan yet.
        </p>
      )}
    </section>
  )
}

function allBlocks(
  groups: CaravanItemGroup[],
  emptyCaravans: Props['emptyCaravans']
): CaravanBlock[] {
  const empty = emptyCaravans.map((caravan) => ({
    key: caravan.id,
    caravan,
    warehouseId: caravan.warehouseId,
    groups: [],
  }))
  return [...byCaravan(groups), ...empty]
}

// Scenario 60 — the Caravan tab: a card per caravan with a row per item
// beneath it, each opening onto its units. Quantities come from the backend
// rollup, so they count every unit rather than the page on screen.
export default function CaravanItemTable({
  groups,
  emptyCaravans,
  emptyLabel,
  ...cardProps
}: Props): React.ReactElement {
  if (groups.length === 0 && emptyCaravans.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-[#e4e4e9] bg-white px-6 py-11 text-center">
        <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
        <div className="mt-1 text-[14px] font-semibold">{emptyLabel}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {allBlocks(groups, emptyCaravans).map((block) => (
        <CaravanCard key={block.key} block={block} {...cardProps} />
      ))}
    </div>
  )
}
