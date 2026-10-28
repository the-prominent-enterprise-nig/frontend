'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft, Package, Send } from 'lucide-react'
import { StatusBadge } from '@/src/components/ui/StatusBadge'
import { MONO } from '../../purchase-orders/_components/procurementTokens'
import { formatShortDate } from '@/src/libs/format/date'
import {
  SERIAL_STATUS_LABELS,
  SERIAL_STATUS_COLORS,
  SERIAL_STATUS_DOT_COLORS,
  SerialStatusSchema,
  caravanKeyOf,
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
import EditCaravanButton from '@/src/components/inventory/caravan/EditCaravanButton'

type GroupSerials = { serials: SerialNumberSummary[]; isLoading: boolean }

type Props = {
  groups: CaravanItemGroup[]
  // Caravans with nothing on hand — running, ended or closed — listed with
  // no items to show.
  emptyCaravans: (WarehouseBranch & { warehouseId: string | null })[]
  // inventory:transfers:create — the "Transfer" menu opens a transfer.
  canTransfer: boolean
  // Edit for anyone managing caravans (the host branch included), Close for
  // head office only.
  caravanActions: CaravanActions
  // The caravan clicked in the list; the first one shows until then.
  pickedKey: string | undefined
  onPick: (key: string) => void
  groupSerials: (key: string) => GroupSerials
  emptyLabel: string
}

export type CaravanActions = {
  canEdit: boolean
  canClose: boolean
  hostBranchOptions: { value: string; label: string }[]
  // A branch-scoped user keeps the caravan at their own branch.
  hostLocked: boolean
}

type CaravanBlock = {
  key: string
  caravan: WarehouseBranch | null
  warehouseId: string | null
  groups: CaravanItemGroup[]
}

const ICON_BUTTON =
  'inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#d3d3db] bg-white text-[#5b21b6] hover:bg-[#f1ebfb]'
const MENU_BUTTON =
  'inline-flex h-7 items-center gap-1 whitespace-nowrap rounded-lg border border-[#d3d3db] bg-white px-2.5 text-[12px] font-medium text-[#5b21b6] hover:bg-[#f1ebfb]'

// Gone for good — everything else still has to be transferred out before
// the caravan can close (mirrors the backend's close check).
const GONE_FOR_GOOD = new Set(['sold', 'issued', 'scrapped', 'lost_in_transit'])

// ── Data helpers ──────────────────────────────────────────────────────────

/** Rows arrive with each caravan's items together (the backend sorts them
 * so); fold consecutive rows of one caravan into one caravan. */
function byCaravan(groups: CaravanItemGroup[]): CaravanBlock[] {
  const blocks: CaravanBlock[] = []
  for (const group of groups) {
    const key = caravanKeyOf(group)
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

function onHandOf(group: CaravanItemGroup): number {
  return (group.statusCounts?.in_stock ?? 0) + (group.statusCounts?.held ?? 0)
}

function blockOnHand(block: CaravanBlock): number {
  return block.groups.reduce((n, g) => n + onHandOf(g), 0)
}

/** Every item's status counts at one caravan, added up. */
function blockStatusCounts(block: CaravanBlock): Record<string, number> {
  const totals: Record<string, number> = {}
  block.groups.forEach((g) =>
    Object.entries(g.statusCounts ?? {}).forEach(([status, n]) => {
      totals[status] = (totals[status] ?? 0) + n
    })
  )
  return totals
}

function unitsLeftOf(block: CaravanBlock): number {
  return Object.entries(blockStatusCounts(block))
    .filter(([status]) => !GONE_FOR_GOOD.has(status))
    .reduce((n, [, count]) => n + count, 0)
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

function caravanDates(caravan: WarehouseBranch | null): string | null {
  if (!caravan?.startDate || !caravan.endDate) return null
  return `${formatShortDate(caravan.startDate)} – ${formatShortDate(caravan.endDate)}`
}

type CaravanStage = { label: string; color: string; dot: string }

/** Running, ending within three days, ended (stock still to clear) or closed. */
function caravanStage(branch: WarehouseBranch | null): CaravanStage {
  if (branch?.closedAt)
    return { label: 'Closed', color: 'bg-[#f1f1f4] text-[#5b5b6b]', dot: 'bg-[#8b8b9b]' }
  if (isCaravanEnded(branch))
    return { label: 'Ended', color: 'bg-[#fdeceb] text-[#b42318]', dot: 'bg-[#b42318]' }
  const days = caravanDaysLeft(branch?.endDate)
  if (days !== null && days <= 3)
    return { label: 'Ending soon', color: 'bg-[#fff4e5] text-[#8a4b06]', dot: 'bg-[#d97706]' }
  return { label: 'Running', color: 'bg-[#e9f7ef] text-[#1a7f4b]', dot: 'bg-[#1a7f4b]' }
}

/** What an ended caravan still needs: units cleared, then head office's close. */
function endedHint(branch: WarehouseBranch | null, unitsLeft: number): string | null {
  if (!branch || branch.closedAt || !isCaravanEnded(branch)) return null
  return unitsLeft > 0 ? `${unitsLeft.toLocaleString()} to transfer out` : 'Ready to close'
}

// ── Small pieces ──────────────────────────────────────────────────────────

function StageBadge({ caravan }: { caravan: WarehouseBranch | null }): React.ReactElement {
  const stage = caravanStage(caravan)
  return (
    <StatusBadge
      label={stage.label}
      colorClassName={stage.color}
      dotClassName={stage.dot}
      size="xs"
    />
  )
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

// ── Actions ───────────────────────────────────────────────────────────────

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

/** Stock Transfer for one caravan: a new one either way, and its history. */
function TransferActions({
  block,
  canTransfer,
}: {
  block: CaravanBlock
  canTransfer: boolean
}): React.ReactElement | null {
  const router = useRouter()
  const { caravan, warehouseId } = block
  if (!warehouseId) return null
  return (
    <>
      {canTransfer && !caravan?.closedAt && (
        <RowActionsMenu
          trigger={{ label: 'Transfer', icon: Send, className: MENU_BUTTON }}
          items={transferMenuItems(caravan, warehouseId, router.push)}
        />
      )}
      <ViewTransfersLink
        warehouseId={warehouseId}
        spelledOut={!isCaravanEnded(caravan) && blockOnHand(block) === 0}
      />
    </>
  )
}

/** A running caravan with nothing on hand yet spells "View transfers" out,
 * to steer staff to where its stock will come in; once it holds stock, or
 * has ended, just the icon. */
function ViewTransfersLink({
  warehouseId,
  spelledOut,
}: {
  warehouseId: string
  spelledOut: boolean
}): React.ReactElement {
  const href = `/inventory/stock-transaction?tab=transfers&warehouseId=${warehouseId}`
  if (spelledOut) {
    return (
      <Link href={href} className={MENU_BUTTON}>
        <ArrowRightLeft className="h-3.5 w-3.5" />
        View transfers
      </Link>
    )
  }
  return (
    <Tooltip label="View transfers into and out of this caravan" side="bottom" align="end">
      <Link href={href} aria-label="View transfers" className={ICON_BUTTON}>
        <ArrowRightLeft className="h-3.5 w-3.5" />
      </Link>
    </Tooltip>
  )
}

/** Edit (until closed) and Close, as the viewer's rights allow. */
function ManageActions({
  block,
  actions,
}: {
  block: CaravanBlock
  actions: CaravanActions
}): React.ReactElement | null {
  const { caravan } = block
  if (!caravan || caravan.closedAt) return null
  return (
    <>
      {actions.canEdit && (
        <EditCaravanButton
          caravan={caravan}
          hostBranchOptions={actions.hostBranchOptions}
          hostLocked={actions.hostLocked}
          className={ICON_BUTTON}
        />
      )}
      {actions.canClose && <CloseCaravanButton caravan={caravan} unitsLeft={unitsLeftOf(block)} />}
    </>
  )
}

// ── Left: the caravan list ────────────────────────────────────────────────

function CaravanListItem({
  block,
  selected,
  onPick,
}: {
  block: CaravanBlock
  selected: boolean
  onPick: () => void
}): React.ReactElement {
  const { caravan } = block
  const hint = endedHint(caravan, unitsLeftOf(block))
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        aria-current={selected}
        className={`flex w-full flex-col gap-1 border-l-[3px] px-4 py-3 text-left transition-colors ${
          selected ? 'border-[#5b21b6] bg-[#f4f0fb]' : 'border-transparent hover:bg-[#fbfaff]'
        } ${caravan?.closedAt ? 'opacity-70' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[13px] font-medium leading-snug text-[#17171c]">
            {caravan ? caravanLabelWithPlace(caravan) : 'Unknown caravan'}
          </span>
          <StageBadge caravan={caravan} />
        </div>
        <div className="text-[11.5px] text-[#8b8b9b]">
          {caravan?.hostBranch?.name ?? '—'} ·{' '}
          <span className={MONO}>{blockOnHand(block).toLocaleString()}</span> on hand
        </div>
        {hint && <div className="text-[11.5px] text-[#b42318]">{hint}</div>}
      </button>
    </li>
  )
}

function CaravanList({
  blocks,
  selectedKey,
  onPick,
}: {
  blocks: CaravanBlock[]
  selectedKey: string
  onPick: (key: string) => void
}): React.ReactElement {
  return (
    <div className="flex min-h-0 flex-col border-b border-[#eeeef1] lg:border-b-0 lg:border-r">
      <div
        className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] px-4 py-[9px] text-[12px] uppercase tracking-[.09em] text-[#8b8b9b]`}
      >
        Caravans · {blocks.length}
      </div>
      <ul className="max-h-[280px] divide-y divide-[#f4f4f6] overflow-y-auto lg:max-h-none lg:flex-1">
        {blocks.map((block) => (
          <CaravanListItem
            key={block.key}
            block={block}
            selected={block.key === selectedKey}
            onPick={() => onPick(block.key)}
          />
        ))}
      </ul>
    </div>
  )
}

// ── Right: the picked caravan ─────────────────────────────────────────────

function DetailHeader({
  block,
  canTransfer,
  caravanActions,
}: {
  block: CaravanBlock
  canTransfer: boolean
  caravanActions: CaravanActions
}): React.ReactElement {
  const { caravan } = block
  const dates = caravanDates(caravan)
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-[#eeeef1] px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-medium text-[#17171c]">
            {caravan ? caravanLabelWithPlace(caravan) : 'Unknown caravan'}
          </h3>
          <div className="mt-0.5 text-[12.5px] text-[#5b5b6b]">
            Hosted at {caravan?.hostBranch?.name ?? '—'}
            {dates && <> · {dates}</>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <TransferActions block={block} canTransfer={canTransfer} />
          <ManageActions block={block} actions={caravanActions} />
        </div>
      </div>
      <DetailStatus block={block} />
    </div>
  )
}

function DetailStatus({ block }: { block: CaravanBlock }): React.ReactElement {
  const { caravan } = block
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {caravan?.endDate && (
        <span className="text-[12px] text-[#5b5b6b]">
          {caravanCountdown(caravan.endDate, caravan.closedAt)}
        </span>
      )}
      {block.groups.length > 0 && <StatusBadges counts={blockStatusCounts(block)} />}
    </div>
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

function UnitRow({ serial }: { serial: SerialNumberSummary }): React.ReactElement {
  return (
    <tr>
      <td className="py-1.5 pl-5 pr-4">
        <div className="flex items-center gap-1.5">
          <SerialLink
            serialId={serial.id}
            serialNumber={serial.serialNumber}
            className={`${MONO} text-[12.5px] text-[#3d3d4a]`}
          />
          <CopySerialButton serialNumber={serial.serialNumber} />
        </div>
      </td>
      <td className="hidden py-1.5 pr-4 text-[12px] text-[#8b8b9b] sm:table-cell">
        {displayClassificationLabel(serial.item?.type?.name) || '—'}
      </td>
      <td className="py-1.5 pr-5 text-right">
        <StatusPill status={serial.status} />
      </td>
    </tr>
  )
}

function UnitsPlaceholder({ isLoading }: { isLoading: boolean }): React.ReactElement {
  return (
    <tr>
      <td colSpan={3} className="py-2 pl-5 pr-4">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-3.5 w-48 animate-pulse rounded bg-[#eeeef1]" />
            ))}
          </div>
        ) : (
          <p className="text-[12px] text-[#8b8b9b]">No units to show for this item.</p>
        )}
      </td>
    </tr>
  )
}

/** One item's line heading its units: its full name (brand and model are
 * already in it) on the left, how many are on hand on the right. */
function ItemHeaderRow({ group }: { group: CaravanItemGroup }): React.ReactElement {
  return (
    <tr className="bg-[#fbfaff]">
      <td colSpan={3} className="px-5 py-2">
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="text-[12.5px] font-medium text-[#17171c]">
              {group.item?.name ?? 'Unknown item'}
            </span>
          </div>
          <span className={`${MONO} whitespace-nowrap text-[12px] text-[#5b5b6b]`}>
            <span className="font-medium text-[#17171c]">{onHandOf(group).toLocaleString()}</span>{' '}
            on hand
          </span>
        </div>
      </td>
    </tr>
  )
}

function ItemWithUnits({
  group,
  units,
}: {
  group: CaravanItemGroup
  units: GroupSerials
}): React.ReactElement {
  return (
    <>
      <ItemHeaderRow group={group} />
      {units.serials.length === 0 ? (
        <UnitsPlaceholder isLoading={units.isLoading} />
      ) : (
        units.serials.map((serial) => <UnitRow key={serial.id} serial={serial} />)
      )}
    </>
  )
}

function emptyCaravanNote(caravan: WarehouseBranch | null): string {
  if (caravan?.closedAt) return 'Closed — everything was transferred out.'
  if (isCaravanEnded(caravan)) return 'Ended and emptied — ready for head office to close.'
  return 'Nothing on hand at this caravan yet.'
}

function DetailItems({
  block,
  groupSerials,
}: {
  block: CaravanBlock
  groupSerials: Props['groupSerials']
}): React.ReactElement {
  if (block.groups.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-[12.5px] text-[#8b8b9b]">
        {emptyCaravanNote(block.caravan)}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10">
          <tr
            className={`${MONO} border-b border-[#eeeef1] bg-[#fbfbfc] text-left text-[11px] uppercase tracking-[.09em] text-[#8b8b9b]`}
          >
            <th className="py-[9px] pl-5 pr-4 font-normal">Item / Serial #</th>
            <th className="hidden py-[9px] pr-4 font-normal sm:table-cell">Type</th>
            <th className="py-[9px] pr-5 text-right font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f1f1f4]">
          {block.groups.map((group) => (
            <ItemWithUnits key={group.key} group={group} units={groupSerials(group.key)} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EmptyState({ label }: { label: string }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-11 text-center">
      <Package className="h-[30px] w-[30px] text-[#c9c9d3]" />
      <div className="mt-1 text-[14px] font-semibold">{label}</div>
    </div>
  )
}

// Scenario 60 — the Caravan tab as a split view: every caravan down the side
// (status, host, stock), and the picked one beside it — its details,
// actions, and every item with its units listed beneath. Quantities come
// from the backend rollup, so they count every unit rather than the page on
// screen.
export default function CaravanItemTable({
  groups,
  emptyCaravans,
  canTransfer,
  caravanActions,
  pickedKey,
  onPick,
  groupSerials,
  emptyLabel,
}: Props): React.ReactElement {
  const blocks: CaravanBlock[] = [
    ...byCaravan(groups),
    ...emptyCaravans.map((c) => ({
      key: c.id,
      caravan: c,
      warehouseId: c.warehouseId,
      groups: [],
    })),
  ]
  if (blocks.length === 0) return <EmptyState label={emptyLabel} />
  const selected = blocks.find((b) => b.key === pickedKey) ?? blocks[0]

  // A fixed height on wide screens, so the list and the detail line up and
  // each scrolls on its own instead of the page growing with the longer one.
  return (
    <div className="grid lg:h-[calc(100vh-300px)] lg:min-h-[520px] lg:grid-cols-[320px_minmax(0,1fr)]">
      <CaravanList blocks={blocks} selectedKey={selected.key} onPick={onPick} />
      <section className="flex min-h-0 min-w-0 flex-col">
        <DetailHeader block={selected} canTransfer={canTransfer} caravanActions={caravanActions} />
        <DetailItems block={selected} groupSerials={groupSerials} />
      </section>
    </div>
  )
}
