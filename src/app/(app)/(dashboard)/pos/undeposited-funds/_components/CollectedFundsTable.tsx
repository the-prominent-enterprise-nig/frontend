'use client'

import { manilaToday } from '@/src/libs/format/manila-date'
import { useState } from 'react'
import { ChevronDown, ChevronRight, CornerDownRight, Landmark } from 'lucide-react'
import { fmtDate, fmtMoney, type AcknowledgementReceipt } from '@/src/libs/data/AccountingV2Data'
import { useMe } from '@/src/hooks/useMe'
import type { PosTurnover } from '../_actions/pos-deposits'
import {
  ActionDialog,
  CorrectTurnoverButton,
  CorrectTurnoverDialog,
  TurnoverActions,
  allowedActions,
  pendingToCorrect,
  type Action,
  type Allowed,
  type TurnoverToCorrect,
} from './TurnoverActions'
import type { BranchGroup, LedgerRow, Selection } from './CashInTransitList'
import type { DepositChoice } from './PosDepositsView'

/**
 * Scenario 83 — the Collected Funds table, laid out as the client's mockup:
 * every movement of a branch's cash on one line — what it collected, what it
 * banked, and what it turned over to (or was turned over by) another branch —
 * with Date · Session / Reference · Type · Sender → Receiver · Slip / Ref no. ·
 * Amount · Status · Action. A pending turnover sent to the branch is
 * acknowledged from its Action column, and nowhere else.
 */

type LineType = 'collection' | 'bank' | 'turnover_in' | 'turnover_out' | 'receipt'
type Tone = 'gray' | 'amber' | 'green' | 'blue'

interface Chip {
  label: string
  tone: Tone
}

/** One table line, whatever it came from. */
export interface LedgerLine {
  key: string
  date: string
  title: string
  detail: string | null
  types: LineType[]
  /** Sender → Receiver, one per place the money went; a lone branch has no
   * receiver. */
  route: Route[]
  slip: string | null
  amount: number
  status: Chip[]
  /** Pending turnovers waiting on this branch: needs Acknowledge / Reject. */
  incoming?: PosTurnover
  /** The session row behind it, to tick or open. */
  row?: LedgerRow
  /** The part of a To-deposit session already deposited or turned over:
   * opens that deposit rather than ticking the session. */
  settled?: boolean
  /** A banked receipt's line: the deposit it opens. */
  openDepositId?: string
  /** Every deposit that banked part of it, when more than one did. */
  openChoices?: DepositChoice[]
  /** A turnover accounting can still correct: pending, or acknowledged with
   * its receipt not yet banked. */
  correctable?: TurnoverToCorrect
}

const TYPE_LABEL: Record<LineType, [string, string]> = {
  collection: ['Branch collection', 'bg-gray-100 text-gray-700'],
  bank: ['Bank deposit', 'bg-gray-100 text-gray-700'],
  turnover_in: ['Turnover in', 'bg-blue-50 text-blue-700'],
  turnover_out: ['Turnover out', 'bg-red-50 text-red-700'],
  receipt: ['New Receipt', 'bg-gray-100 text-gray-700'],
}

const TONE: Record<Tone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
}

interface Route {
  from: string
  to: string | null
}

const via = (from: string, to: string | null): Route => ({ from, to })

/** "Antique → BDO" for the spreadsheet, where there is no icon. */
const routeText = (r: Route): string => (r.to ? `${r.from} → ${r.to}` : r.from)

/** Routes by sender, in order: "Mabini" with every place its cash went. A
 * sender with no receiver (the branch's own collection) adds no line of its
 * own when the same sender also sent somewhere. */
function bySender(routes: Route[]): [string, string[]][] {
  const grouped = new Map<string, string[]>()
  for (const r of routes) {
    const receivers = grouped.get(r.from) ?? []
    if (r.to && !receivers.includes(r.to)) receivers.push(r.to)
    grouped.set(r.from, receivers)
  }
  return [...grouped.entries()]
}

/** "Dumalag Caravan — caravan of Roxas" reads as the caravan in a route. */
const shortName = (name: string): string => name.split(' — ')[0]

const unique = (values: (string | null | undefined)[]): string[] => [
  ...new Set(values.filter((v): v is string => !!v)),
]

// --- Lines, from each kind of row ----------------------------------------

/** What every line of a session shares: the session, and the slips and
 * turnover numbers its posted deposits carry. */
function sessionBase(
  row: LedgerRow
): Pick<LedgerLine, 'key' | 'title' | 'detail' | 'slip' | 'row'> {
  return {
    key: row.key,
    title: row.terminalCode ?? '—',
    // As the client's mockup reads: the branch's own sessions, against the
    // "Received from …" of a turnover slip. Search still finds the cashier.
    detail: 'Own sessions',
    slip:
      unique([
        ...row.bankSlips.map((s) => s.reference),
        ...row.turnovers.map((t) => t.reference),
      ]).join(', ') || null,
    row,
  }
}

/**
 * A session's lines. One a deposit or turnover took only part of reads as
 * two: the part already gone — to a bank or another branch — and the part
 * still to deposit, so the lines add up to what the session collected.
 */
export function sessionLines(row: LedgerRow, canManage: boolean): LedgerLine[] {
  if (row.status === 'to_deposit' && row.deposited > 0) {
    return [
      { ...goneLine(row, canManage), key: `${row.key}:settled`, settled: true },
      { ...toDepositLine(row), slip: null },
    ]
  }
  if (row.status === 'to_deposit') return [toDepositLine(row)]
  if (row.status === 'awaiting') {
    return [
      {
        ...sessionBase(row),
        date: row.closedAt,
        types: ['bank'],
        route: [via(shortName(row.branchName), row.bankName)],
        amount: row.amount,
        status: [{ label: 'Awaiting clearing', tone: 'amber' }],
      },
    ]
  }
  return [goneLine(row, canManage)]
}

/** What the session still has to deposit. */
function toDepositLine(row: LedgerRow): LedgerLine {
  return {
    ...sessionBase(row),
    date: row.closedAt,
    types: ['collection'],
    route: [via(shortName(row.branchName), null)],
    amount: row.amount,
    status: [{ label: 'For deposit', tone: 'gray' }],
  }
}

/** What left the session: to a bank, another branch, or both. */
function goneLine(row: LedgerRow, canManage: boolean): LedgerLine {
  const from = shortName(row.branchName)
  const banks = row.bankSlips.map((s) => via(from, bankLabel(s.bankName, s.accountLast4)))
  const turnedTo = row.turnovers.map((t) => via(from, t.toBranchName))
  const banked = row.bankSlips.length > 0 || row.turnovers.length === 0
  return {
    ...sessionBase(row),
    date: row.depositDate ?? row.closedAt,
    types: [
      ...(banked ? (['bank'] as const) : []),
      ...(row.turnovers.length ? (['turnover_out'] as const) : []),
    ],
    route: [...(banks.length ? banks : banked ? [via(from, row.bankName)] : []), ...turnedTo],
    amount: row.deposited,
    status: [
      ...(banked ? [{ label: 'Deposited', tone: 'green' as const }] : []),
      ...turnoverChips(row),
      ...(canManage && banked && row.hasProof === false
        ? [{ label: 'No slip', tone: 'amber' as const }]
        : []),
    ],
  }
}

/** The sender's side of a turnover: waiting on the receiving branch, or done. */
function turnoverChips(row: LedgerRow): Chip[] {
  if (!row.turnovers.length) return []
  return row.turnovers.some((t) => t.status === 'pending')
    ? [{ label: 'Awaiting acknowledgment', tone: 'amber' }]
    : [{ label: 'Acknowledged', tone: 'green' }]
}

/** An unbanked New Receipt — or an acknowledged turnover, which becomes one
 * at the receiving branch and is deposited with its day. */
export function receiptLine(receipt: AcknowledgementReceipt, branchName: string): LedgerLine {
  const left = Number(receipt.amount ?? 0)
  // The banked part is a line of its own (bankedReceiptLine).
  const due: Chip = { label: 'For deposit', tone: 'gray' }
  const here = shortName(branchName)
  if (receipt.turnoverLine) {
    const sender = receipt.payerName.replace(/^Turnover from /, '')
    return {
      key: receipt.id,
      date: receipt.paymentDate,
      title: 'Turnover slip',
      detail: `Received from ${sender}`,
      types: ['turnover_in'],
      route: [via(sender, here)],
      slip: receipt.turnoverLine.reference,
      amount: left,
      status: [{ label: 'Acknowledged', tone: 'green' }],
      correctable: {
        lineId: receipt.turnoverLine.id,
        amount: left,
        reference: receipt.turnoverLine.reference ?? '',
        date: receipt.paymentDate.slice(0, 10),
        receivedBy: '',
        senderName: sender,
        toBranchName: branchName,
        acknowledged: true,
      },
    }
  }
  return {
    key: receipt.id,
    date: receipt.paymentDate,
    title: receipt.number ?? 'New Receipt',
    detail: receipt.payerName,
    types: ['receipt'],
    route: [via(here, null)],
    slip: receipt.reference ?? null,
    amount: left,
    status: [due],
  }
}

/** "BDO - Iznart ••8921". The last four only when they are digits — an
 * account stored as "N/A" shows its name alone. */
function bankLabel(name: string, accountTail: string | null | undefined): string {
  const last4 = accountTail?.match(/\d{4}$/)?.[0]
  return last4 ? `${name} ••${last4}` : name
}

/**
 * Scenario 83 — a New Receipt (an acknowledged turnover among them) that
 * posted deposits banked: one Deposited line, so it stays on the table once
 * banked. No bank: which deposit "took" which part of it is the system's own
 * oldest-first share-out, not where that cash actually went, so naming banks
 * would claim something nobody knows.
 */
export function bankedReceiptLine(receipt: AcknowledgementReceipt, branchName: string): LedgerLine {
  const here = shortName(branchName)
  const sender = receipt.turnoverLine ? receipt.payerName.replace(/^Turnover from /, '') : null
  const deposits = (receipt.depositAllocations ?? []).map((a) => a.posDeposit)
  const dates = deposits.map((d) => d.depositDate).sort()
  return {
    key: `${receipt.id}:banked`,
    date: dates[dates.length - 1] ?? receipt.paymentDate,
    title: sender ? 'Turnover slip' : (receipt.number ?? 'New Receipt'),
    detail: sender ? `Received from ${sender}` : receipt.payerName,
    types: [sender ? 'turnover_in' : 'receipt'],
    route: [sender ? via(sender, here) : via(here, null)],
    slip: receipt.turnoverLine?.reference ?? receipt.reference ?? null,
    amount: Number(receipt.depositedAmount ?? 0),
    status: [{ label: 'Deposited', tone: 'green' }],
    openDepositId: deposits[deposits.length - 1]?.id,
    openChoices: receiptDepositChoices(receipt),
  }
}

/** The deposits that banked a receipt, oldest first, each labelled by its
 * slip numbers and how much of the receipt it took. */
function receiptDepositChoices(receipt: AcknowledgementReceipt): DepositChoice[] {
  return [...(receipt.depositAllocations ?? [])]
    .sort((a, b) => a.posDeposit.depositDate.localeCompare(b.posDeposit.depositDate))
    .map((a) => ({
      id: a.posDeposit.id,
      label: [
        unique(a.posDeposit.lines.map((l) => l.reference)).join(', ') || 'No slip no.',
        fmtMoney(Number(a.cashAmount)),
      ].join(' · '),
    }))
}

/** A turnover sent to this branch, still waiting for it to acknowledge. */
export function incomingLine(t: PosTurnover, canAcknowledge: boolean): LedgerLine {
  return {
    key: `turnover:${t.id}`,
    date: t.depositDate ?? t.createdAt,
    title: 'Turnover slip',
    detail: `Received from ${t.senderName}`,
    types: ['turnover_in'],
    route: [via(t.senderName, t.turnoverToBranch.name)],
    slip: t.reference,
    amount: Number(t.amount),
    status: [
      canAcknowledge
        ? { label: 'Pending · needs your action', tone: 'amber' }
        : { label: 'Awaiting acknowledgment', tone: 'amber' },
    ],
    incoming: t,
    correctable: pendingToCorrect(t),
  }
}

/** A branch's lines: what needs its action first, then newest first. */
export function groupLines(
  group: BranchGroup,
  canManage: boolean,
  canAcknowledge: (t: PosTurnover) => boolean
): LedgerLine[] {
  const dated = [
    ...group.rows.flatMap((r) => sessionLines(r, canManage)),
    ...group.receipts.map((r) => receiptLine(r, group.branchName)),
    ...group.bankedReceipts.map((r) => bankedReceiptLine(r, group.branchName)),
  ].sort((a, b) => b.date.localeCompare(a.date))
  const waiting = group.incoming
    .map((t) => incomingLine(t, canAcknowledge(t)))
    .sort((a, b) => a.date.localeCompare(b.date))
  return [...waiting, ...dated]
}

/** A branch's collected and deposited money, as the old ledger's columns
 * read: a session's whole take (what earlier deposits banked of a
 * To-deposit one added back), and what deposits — or turnovers to another
 * branch — took of it; receipts the same way. A deposit still waiting on
 * accounting has banked nothing yet. Turnovers sent to the branch count once
 * acknowledged (as receipts), not before. */
function moneyOf(group: BranchGroup): { collected: number; deposited: number } {
  let collected = 0
  let deposited = 0
  for (const r of group.rows) {
    const banked = r.status === 'awaiting' ? 0 : r.deposited
    collected += r.status === 'to_deposit' ? r.amount + r.deposited : r.amount
    deposited += banked
  }
  // A receipt's part still to bank, and — on rows of their own — what posted
  // deposits banked of it, so one partly banked is counted once.
  for (const r of group.receipts) collected += Number(r.amount ?? 0)
  for (const r of group.bankedReceipts) {
    const banked = Number(r.depositedAmount ?? 0)
    collected += banked
    deposited += banked
  }
  return { collected, deposited }
}

/** Opens a deposit; `choices` are every deposit behind the row, when more
 * than one banked it. */
export type OpenDeposit = (id: string, choices?: DepositChoice[]) => void

/**
 * Every posted deposit behind a session, from its slips and turnovers, each
 * labelled by its slip numbers and what it banked. A session banked over
 * several trips to the bank reads as several, so none is hidden behind the
 * one that happened to finish it.
 */
export function depositChoices(row: LedgerRow): DepositChoice[] {
  const byDeposit = new Map<string, { refs: string[]; amount: number }>()
  const items = [
    ...row.bankSlips.map((s) => ({ id: s.depositId, ref: s.reference, amount: s.amount })),
    ...row.turnovers.map((t) => ({ id: t.depositId, ref: t.reference, amount: t.amount })),
  ]
  for (const item of items) {
    const entry = byDeposit.get(item.id) ?? { refs: [], amount: 0 }
    if (item.ref && !entry.refs.includes(item.ref)) entry.refs.push(item.ref)
    entry.amount += item.amount
    byDeposit.set(item.id, entry)
  }
  return [...byDeposit].map(([id, { refs, amount }]) => ({
    id,
    label: [refs.join(', ') || 'No slip no.', fmtMoney(amount)].join(' · '),
  }))
}

// --- The table -----------------------------------------------------------

export function CollectedFundsTable({
  groups,
  loading,
  canManage,
  canCorrect = false,
  selection,
  onOpenDeposit,
  onDepositReceipts,
  onTurnoverChanged,
  empty,
}: {
  groups: BranchGroup[]
  loading: boolean
  canManage: boolean
  /** Accounting: may correct a pending turnover from its row. */
  canCorrect?: boolean
  selection: Selection
  onOpenDeposit: OpenDeposit
  onDepositReceipts: (group: BranchGroup) => void
  onTurnoverChanged: () => void
  empty: string
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [acting, setActing] = useState<{ turnover: PosTurnover; kind: Action } | null>(null)
  const { data: me } = useMe()
  const allowed = (t: PosTurnover): Allowed => allowedActions(t, canManage, me)
  const [correcting, setCorrecting] = useState<TurnoverToCorrect | null>(null)
  const columns = canManage ? 9 : 8
  const shown = groups.map((group) => ({
    group,
    lines: groupLines(group, canManage, (t) => allowed(t).acknowledge),
  }))
  const toggleCollapsed = (id: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    // No horizontal scroll: the page is full width, so the columns fit and
    // cells wrap on a narrow screen instead.
    <div className="rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <LedgerHead canManage={canManage} />
        {loading || groups.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns} className="px-3 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          </tbody>
        ) : (
          shown.map(({ group, lines }) => (
            <BranchRows
              key={group.branchId}
              group={group}
              // Always: the branch's collected, deposited and balance live here.
              showHeader
              lines={lines}
              open={!collapsed.has(group.branchId)}
              onToggleOpen={() => toggleCollapsed(group.branchId)}
              canManage={canManage}
              selection={selection}
              allowed={allowed}
              onAct={(turnover, kind) => setActing({ turnover, kind })}
              onCorrect={canCorrect ? setCorrecting : undefined}
              onOpenDeposit={onOpenDeposit}
              onDepositReceipts={() => onDepositReceipts(group)}
            />
          ))
        )}
      </table>
      {correcting && (
        <CorrectTurnoverDialog
          turnover={correcting}
          onClose={() => setCorrecting(null)}
          onDone={() => {
            setCorrecting(null)
            onTurnoverChanged()
          }}
        />
      )}
      {acting && (
        <ActionDialog
          {...acting}
          onClose={() => setActing(null)}
          onDone={() => {
            setActing(null)
            onTurnoverChanged()
          }}
        />
      )}
    </div>
  )
}

function LedgerHead({ canManage }: { canManage: boolean }): React.JSX.Element {
  const th = 'px-3 py-2 font-medium'
  // Shrunk to their content: the spare width goes to the text columns, so a
  // status and its action sit together instead of at opposite edges.
  const fit = `${th} w-px whitespace-nowrap`
  return (
    <thead className="bg-gray-50 text-xs text-gray-600">
      <tr>
        {canManage && <th className="w-10 px-3 py-2" />}
        <th className={`${fit} text-left`}>Date</th>
        <th className={`${th} text-left`}>Session / Reference</th>
        <th className={`${fit} text-left`}>Type</th>
        <th className={`${th} text-left`}>Sender → Receiver</th>
        <th className={`${th} text-left`}>Slip / Ref no.</th>
        <th className={`${fit} text-right`}>Amount</th>
        <th className={`${fit} text-left`}>Status</th>
        <th className={`${fit} text-right`}>Action</th>
      </tr>
    </thead>
  )
}

/** One branch: a header row (select all, collapse, Record deposit),
 * then its lines when open. */
function BranchRows({
  group,
  showHeader,
  lines,
  open,
  onToggleOpen,
  canManage,
  selection,
  allowed,
  onAct,
  onCorrect,
  onOpenDeposit,
  onDepositReceipts,
}: {
  group: BranchGroup
  showHeader: boolean
  lines: LedgerLine[]
  open: boolean
  onToggleOpen: () => void
  canManage: boolean
  selection: Selection
  allowed: (t: PosTurnover) => Allowed
  onAct: (t: PosTurnover, kind: Action) => void
  /** Accounting only: opens the turnover correction form. */
  onCorrect?: (t: TurnoverToCorrect) => void
  onOpenDeposit: OpenDeposit
  onDepositReceipts: () => void
}): React.JSX.Element {
  const selectable = group.rows.filter((r) => r.status === 'to_deposit')
  // New Receipts — an acknowledged turnover among them — are always banked
  // from their own row, even while older sessions wait: a short deposit with
  // sessions in it banks the sessions first, so riding on one would leave
  // them unbanked. A ticked session's deposit never takes a turnover.
  const receiptsAlone = canManage && group.receipts.length > 0
  const allPicked = selectable.length > 0 && selectable.every((r) => selection.has(r.sessionId))
  const receiptKeys = new Set(group.receipts.map((r) => r.id))
  const firstReceiptKey = lines.find((l) => receiptKeys.has(l.key))?.key
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <tbody className="divide-y divide-gray-100 border-t border-gray-200">
      {showHeader && (
        <tr className="bg-prominent-purple-50/40">
          {canManage && (
            <td className="px-3 py-2">
              {selectable.length > 0 && (
                <input
                  type="checkbox"
                  checked={allPicked}
                  onChange={() => selection.toggleGroup(group)}
                  aria-label={`Select all of ${group.branchName}`}
                />
              )}
            </td>
          )}
          <td colSpan={5} className="px-3 py-2.5">
            <button onClick={onToggleOpen} className="flex items-center gap-2 text-left">
              <Chevron className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{group.branchName}</span>
              <span className="text-xs text-gray-500">{groupCounts(group)}</span>
            </button>
          </td>
          {/* Under Amount, unlabelled: what the branch collected, which the
              lines beneath break down. */}
          <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap text-gray-900">
            {/* Nothing collected yet — only a turnover still awaiting its
                acknowledgment, say — reads as a dash, not a bold ₱0.00. */}
            {moneyOf(group).collected > 0.005 ? (
              fmtMoney(moneyOf(group).collected)
            ) : (
              <span className="font-normal text-gray-400">—</span>
            )}
          </td>
          <td colSpan={2} />
        </tr>
      )}
      {(open || !showHeader) &&
        lines.map((line) => (
          <LineRow
            key={line.key}
            line={line}
            // New Receipts — an acknowledged turnover, say — are deposited on
            // their own from the first receipt's row; the form takes in all
            // of the branch's unbanked receipts and no session.
            onDepositReceipts={
              receiptsAlone && line.key === firstReceiptKey ? onDepositReceipts : undefined
            }
            canManage={canManage}
            selection={selection}
            allowed={line.incoming ? allowed(line.incoming) : null}
            onAct={(kind) => line.incoming && onAct(line.incoming, kind)}
            onCorrect={
              onCorrect && line.correctable ? () => onCorrect(line.correctable!) : undefined
            }
            onOpenDeposit={onOpenDeposit}
          />
        ))}
    </tbody>
  )
}

function groupCounts(group: BranchGroup): string {
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
  return [
    plural(group.rows.length, 'session'),
    group.receipts.length > 0 && plural(group.receipts.length, 'receipt'),
    group.incoming.length > 0 && `${plural(group.incoming.length, 'turnover')} to acknowledge`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** A To-deposit session ticks; any other session opens the deposit it is in
 * (a Partially deposited one, the deposit that banked part of it). */
function LineRow({
  line,
  onDepositReceipts,
  canManage,
  selection,
  allowed,
  onAct,
  onCorrect,
  onOpenDeposit,
}: {
  line: LedgerLine
  onDepositReceipts?: () => void
  canManage: boolean
  selection: Selection
  allowed: Allowed | null
  onAct: (kind: Action) => void
  onCorrect?: () => void
  onOpenDeposit: OpenDeposit
}): React.JSX.Element {
  const row = line.row
  // The still-to-deposit part ticks; the part already gone opens its deposit.
  const pickable = canManage && row?.status === 'to_deposit' && !line.settled
  const opensId = row
    ? row.status === 'to_deposit'
      ? row.bankedDepositId
      : row.depositId
    : (line.openDepositId ?? null)
  const onClick =
    row && pickable
      ? () => selection.toggle(row)
      : opensId
        ? () => onOpenDeposit(opensId, row ? depositChoices(row) : line.openChoices)
        : undefined
  return (
    <tr onClick={onClick} className={`hover:bg-gray-50 ${onClick ? 'cursor-pointer' : ''}`}>
      {canManage && (
        <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
          {row && pickable && (
            <input
              type="checkbox"
              checked={selection.has(row.sessionId)}
              onChange={() => selection.toggle(row)}
              aria-label="Select session"
            />
          )}
        </td>
      )}
      <td className="px-3 py-3 align-top whitespace-nowrap">{fmtDate(line.date)}</td>
      <td className="px-3 py-3 align-top">
        <div>{line.title}</div>
        {line.detail && <div className="text-xs text-gray-500">{line.detail}</div>}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <span className="flex flex-col items-start gap-1">
          {line.types.map((type) => (
            <TypeChip key={type} type={type} />
          ))}
        </span>
      </td>
      <td className="px-3 py-3 align-top font-medium text-gray-900">
        {bySender(line.route).map(([from, receivers]) => (
          // Each sender once, its receivers on the lines under it.
          <div key={from} className="[&+&]:mt-1.5">
            <div>{from}</div>
            {receivers.map((to) => (
              <div key={to} className="flex items-center gap-1 font-normal text-gray-700">
                <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-label="to" />
                <span>{to}</span>
              </div>
            ))}
          </div>
        ))}
      </td>
      <td className="px-3 py-3 align-top">
        {line.slip ?? <span className="text-gray-400">—</span>}
      </td>
      <td
        className={`px-3 py-3 text-right align-top tabular-nums whitespace-nowrap ${
          // Not this branch's cash until acknowledged.
          line.incoming ? 'text-gray-400' : ''
        }`}
      >
        {fmtMoney(line.amount)}
      </td>
      <td className="px-3 py-3 align-top whitespace-nowrap">
        <span className="flex flex-col items-start gap-1">
          {line.status.map((chip) => (
            <span
              key={chip.label}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[chip.tone]}`}
            >
              {chip.label}
            </span>
          ))}
        </span>
      </td>
      <td
        className="px-3 py-3 text-right align-top whitespace-nowrap"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="inline-flex items-center gap-2">
          {onCorrect && <CorrectTurnoverButton onClick={onCorrect} />}
          {allowed && <TurnoverActions allowed={allowed} onAct={onAct} />}
        </span>
        {onDepositReceipts && (
          <button
            type="button"
            onClick={onDepositReceipts}
            className="inline-flex items-center gap-1.5 rounded-lg bg-purple-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-800"
          >
            <Landmark className="h-3.5 w-3.5" /> Record deposit
          </button>
        )}
      </td>
    </tr>
  )
}

function TypeChip({ type }: { type: LineType }): React.JSX.Element {
  const [label, tone] = TYPE_LABEL[type]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tone}`}>{label}</span>
}

/** The table as a spreadsheet: the same lines, the same columns. */
export function exportLedgerCsv(groups: BranchGroup[]): void {
  const headers = [
    'Branch',
    'Date',
    'Session / Reference',
    'Detail',
    'Type',
    'Sender → Receiver',
    'Slip / Ref no.',
    'Amount',
    'Status',
  ]
  const shown = groups.map((group) => ({ group, lines: groupLines(group, false, () => false) }))
  const dataRows = shown.flatMap(({ group, lines }) =>
    lines.map((l) => [
      group.branchName,
      fmtDate(l.date),
      l.title,
      l.detail ?? '',
      l.types.map((t) => TYPE_LABEL[t][0]).join(' + '),
      l.route.map(routeText).join('; '),
      l.slip ?? '',
      l.amount,
      l.status.map((c) => c.label).join(', '),
    ])
  )
  const csv = [headers, ...dataRows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `collected-funds-history-${manilaToday()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
