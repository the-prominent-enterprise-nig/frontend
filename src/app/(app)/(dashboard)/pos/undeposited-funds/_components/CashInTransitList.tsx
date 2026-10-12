'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Landmark, Search, X } from 'lucide-react'
import {
  getCashInTransitHistory,
  getCashInTransitReport,
  getCashInTransitSummary,
  type CashInTransitHistoryRow,
  type CashInTransitSessionRow,
} from '../../_actions/pos-actions'
import {
  AcknowledgementReceipts,
  type AcknowledgementReceipt,
  BankAccounts,
  type BankAccount,
  fmtMoney,
  fmtDate,
} from '@/src/libs/data/AccountingV2Data'
import { getAccounts, type Account } from '@/src/libs/data/AccountingData'
import AttachmentsPanel, { uploadAndAttach } from '@/src/components/common/AttachmentsPanel'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { createPosDeposit } from '../_actions/pos-deposits'
import {
  DepositDetailLoader,
  POS_DEPOSIT_ENTITY,
  daysSince,
  refreshDeposits,
  useDepositSummary,
} from './PosDepositsView'

const SESSIONS_KEY = 'undeposited-sessions'
const NEW_RECEIPTS_KEY = 'unbanked-new-receipts'

/** The branch's New Receipts still to be banked — or every branch's, for no
 * branch. Money taken at the counter against no sale, banked with the day. */
function useUnbankedReceipts(branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: [NEW_RECEIPTS_KEY, branchId],
    queryFn: () =>
      AcknowledgementReceipts.list({ branchId: branchId ?? undefined, unbanked: 'true' }),
    enabled,
    staleTime: 0,
  })
}

/** Where a session's cash is: still to bank, in a deposit waiting on
 * accounting, or banked. */
type LedgerStatus = 'to_deposit' | 'awaiting' | 'deposited'
type StatusFilter = LedgerStatus | 'all'

/** One row of the Undeposited Funds table — a session, wherever it is. */
interface LedgerRow {
  sessionId: string
  branchId: string
  branchName: string
  terminalCode: string | null
  cashierName: string | null
  closedAt: string
  /** The session's whole branch collection: `cash` plus `clearing`. */
  amount: number
  /** What sits in Undeposited Funds — drawer cash and cheques. The cash
   * slips of a deposit must come to this exactly. */
  cash: number
  /** Card and e-wallet money waiting in processors' clearing accounts. */
  clearing: number
  status: LedgerStatus
  /** The deposit it is in, when it is in one with a record. */
  depositId: string | null
  bankName: string | null
  depositDate: string | null
}

function amounts(
  cash: number,
  clearing: number | undefined,
  receipts: number | undefined
): Pick<LedgerRow, 'amount' | 'cash' | 'clearing'> {
  const c = Number(cash || 0)
  const k = Number(clearing || 0)
  // A deposit's New Receipts ride on one of its sessions (G11).
  return { amount: c + k + Number(receipts || 0), cash: c, clearing: k }
}

function fromOutstanding(r: CashInTransitSessionRow): LedgerRow {
  return {
    sessionId: r.sessionId,
    branchId: r.branchId ?? 'none',
    branchName: r.branchName ?? 'No branch',
    terminalCode: r.terminalCode,
    cashierName: r.cashierName,
    closedAt: r.closedAt,
    ...amounts(r.amount, r.clearingAmount, r.newReceiptsAmount),
    status: r.pendingDeposit ? 'awaiting' : 'to_deposit',
    depositId: r.pendingDeposit?.id ?? null,
    bankName: r.pendingDeposit?.bankName ?? null,
    depositDate: r.pendingDeposit?.depositDate ?? null,
  }
}

function fromDeposited(r: CashInTransitHistoryRow): LedgerRow {
  return {
    sessionId: r.sessionId,
    branchId: r.branchId ?? 'none',
    branchName: r.branchName ?? 'No branch',
    terminalCode: r.terminalCode,
    cashierName: r.cashierName,
    closedAt: r.closedAt,
    ...amounts(r.amount, r.clearingAmount, r.newReceiptsAmount),
    status: 'deposited',
    depositId: r.posDepositId,
    bankName: r.depositedTo,
    depositDate: r.depositDate ?? r.citClearedAt,
  }
}

const STATUS_TEXT: Record<LedgerStatus, string> = {
  to_deposit: 'To deposit',
  awaiting: 'Awaiting clearing',
  deposited: 'Deposited',
}

function exportLedgerCsv(rows: LedgerRow[]): void {
  const headers = [
    'Branch',
    'Terminal',
    'Cashier',
    'Closed At',
    'Status',
    'Bank',
    'Deposit Date',
    'Amount',
  ]
  const dataRows = rows.map((r) => [
    r.branchName,
    r.terminalCode ?? '',
    r.cashierName ?? '',
    fmtDate(r.closedAt),
    STATUS_TEXT[r.status],
    r.bankName ?? '',
    r.depositDate ? fmtDate(r.depositDate) : '',
    r.amount,
  ])
  const csv = [headers, ...dataRows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `undeposited-funds-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

interface BranchGroup {
  branchId: string
  branchName: string
  rows: LedgerRow[]
  /** Unbanked New Receipts with no To-deposit session to ride on — shown as
   * rows of their own, in what the branch still has to deposit. */
  receipts: AcknowledgementReceipt[]
  total: number
}

/**
 * Scenario 70 G11 — a branch's unbanked New Receipts are banked with its next
 * deposit, so they count on its latest To-deposit session, the way a deposit's
 * receipts count on one of its sessions once recorded. The same day reads as
 * one figure before and after Record deposit. Rows are copied, not changed:
 * the summary cards add receipts up themselves.
 */
function foldReceipts(
  rows: LedgerRow[],
  receipts: AcknowledgementReceipt[]
): { rows: LedgerRow[]; loose: AcknowledgementReceipt[] } {
  const latest = new Map<string, LedgerRow>()
  for (const r of rows) {
    const current = latest.get(r.branchId)
    if (r.status === 'to_deposit' && (!current || r.closedAt > current.closedAt)) {
      latest.set(r.branchId, r)
    }
  }
  const extra = new Map<string, number>()
  const loose: AcknowledgementReceipt[] = []
  for (const receipt of receipts) {
    const host = latest.get(receipt.branchId ?? 'none')
    if (!host) loose.push(receipt)
    else extra.set(host.sessionId, (extra.get(host.sessionId) ?? 0) + Number(receipt.amount ?? 0))
  }
  return {
    rows: rows.map((r) =>
      extra.has(r.sessionId) ? { ...r, amount: r.amount + (extra.get(r.sessionId) ?? 0) } : r
    ),
    loose,
  }
}

/** By branch, busiest first: a deposit is one branch's cash, so the table is
 * read — and selected — a branch at a time. */
function groupByBranch(allRows: LedgerRow[], allReceipts: AcknowledgementReceipt[]): BranchGroup[] {
  const { rows, loose } = foldReceipts(allRows, allReceipts)
  const groups = new Map<string, BranchGroup>()
  const groupOf = (id: string, name: string): BranchGroup => {
    const group = groups.get(id) ?? {
      branchId: id,
      branchName: name,
      rows: [],
      receipts: [],
      total: 0,
    }
    groups.set(id, group)
    return group
  }
  for (const r of rows) {
    const group = groupOf(r.branchId, r.branchName)
    group.rows.push(r)
    group.total += r.amount
  }
  for (const r of loose) {
    const group = groupOf(r.branchId ?? 'none', r.branch?.name ?? 'No branch')
    group.receipts.push(r)
    group.total += Number(r.amount ?? 0)
  }
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

function receiptMatches(r: AcknowledgementReceipt, term: string): boolean {
  if (!term) return true
  const haystack = [r.branch?.name, r.payerName, r.number].filter(Boolean).join(' ')
  return haystack.toLowerCase().includes(term.toLowerCase())
}

function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toLocaleDateString('en-CA')
}

function matches(row: LedgerRow, term: string): boolean {
  if (!term) return true
  const haystack = [row.branchName, row.terminalCode, row.cashierName, row.bankName]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(term.toLowerCase())
}

/**
 * Undeposited Funds — every session in one table (Scenario 61 Part 5),
 * grouped by branch, with where its cash is: To deposit → Awaiting clearing
 * → Deposited. Tick To-deposit sessions to record a deposit; click any other
 * row to open its deposit (proof, Clear, Cancel). Head Office and the owner
 * pick a branch (or all); a branch-assigned user is held to their own.
 */
export function CashInTransitList({
  canManage,
  canVerify = false,
  restrictedBranchId,
  isUnrestricted,
  // "Undeposited Funds" — the client's own word, and the BALANCE column on
  // their Daily Collection Report. The route, permissions and legacy GL
  // account keep the cash-in-transit name.
  title = 'Undeposited Funds',
}: {
  canManage: boolean
  /** Scenario 61 Part 5 — may clear (post) a deposit draft: accounting only. */
  canVerify?: boolean
  restrictedBranchId: string | null
  isUnrestricted: boolean
  title?: string
}) {
  const queryClient = useQueryClient()
  const [pickedBranchId, setPickedBranchId] = useState<string | null>(null)
  const branchId = restrictedBranchId ?? pickedBranchId
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [range, setRange] = useState({ from: daysAgo(30), to: daysAgo(0) })
  const [search, setSearch] = useState('')
  const ledger = useLedger(branchId, filter, range)
  const shown = ledger.rows.filter(
    (r) => (filter === 'all' || r.status === filter) && matches(r, search)
  )
  // New Receipts are still to deposit, so they show only beside sessions in
  // that state.
  const unbanked = useUnbankedReceipts(branchId).data?.data ?? []
  const shownReceipts =
    filter === 'to_deposit' || filter === 'all'
      ? unbanked.filter((r) => receiptMatches(r, search))
      : []
  const selection = useSingleBranchSelection(ledger.rows)
  const [depositing, setDepositing] = useState<LedgerRow[] | null>(null)
  const [openDepositId, setOpenDepositId] = useState<string | null>(null)

  /** After any deposit action: the table, the cards and the branch totals. */
  const refreshAll = (): void => {
    selection.clear()
    void queryClient.invalidateQueries({ queryKey: [SESSIONS_KEY] })
    void queryClient.invalidateQueries({ queryKey: ['undeposited-branches'] })
    void queryClient.invalidateQueries({ queryKey: [NEW_RECEIPTS_KEY] })
    refreshDeposits(queryClient)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-prominent-purple-900">{title}</h2>
          <p className="text-sm text-gray-500">
            Closed sessions&apos; cash, from the drawer to the bank.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isUnrestricted && (
            <BranchPicker
              value={pickedBranchId}
              onChange={(id) => {
                setPickedBranchId(id)
                selection.clear()
              }}
            />
          )}
          <button
            onClick={() => exportLedgerCsv(shown)}
            disabled={shown.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" /> Export to Excel
          </button>
          {/* In the header, not the filter row: a wider filter row (the date
              range under Deposited / All) used to wrap it onto a new line. */}
          {canManage && (
            <button
              onClick={() => setDepositing(selection.rows)}
              disabled={selection.rows.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg hover:bg-purple-800 disabled:opacity-50"
            >
              <Landmark className="w-4 h-4" /> Record Deposit
              {selection.rows.length > 0 &&
                ` · ${selection.rows[0].branchName} (${selection.rows.length})`}
            </button>
          )}
        </div>
      </div>

      <SummaryCards rows={ledger.rows} branchId={branchId} />

      <Toolbar
        filter={filter}
        onFilter={setFilter}
        counts={ledger.counts}
        range={range}
        onRange={setRange}
        search={search}
        onSearch={setSearch}
      />

      <LedgerTable
        groups={groupByBranch(shown, shownReceipts)}
        loading={ledger.loading}
        canManage={canManage}
        selection={selection}
        onOpenDeposit={setOpenDepositId}
        empty={ledger.loading ? 'Loading...' : 'Nothing here for these filters.'}
      />
      {ledger.capped && (
        <p className="mt-1 text-xs text-amber-700">
          Showing the first 500 deposited sessions — narrow the dates to see the rest.
        </p>
      )}

      {depositing && (
        <DepositForm
          accounts={ledger.accounts}
          sessions={depositing}
          branchId={depositing[0]?.branchId ?? null}
          onClose={() => setDepositing(null)}
          onSaved={() => {
            setDepositing(null)
            refreshAll()
          }}
        />
      )}
      {openDepositId && (
        <DepositDetailLoader
          id={openDepositId}
          canManage={canManage}
          canVerify={canVerify}
          onClose={() => setOpenDepositId(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  )
}

/**
 * The table's rows: sessions still in the drawer (to deposit or awaiting
 * clearing) always — there are never many — plus, when asked for, sessions
 * banked within the chosen closed-date range.
 */
function useLedger(
  branchId: string | null,
  filter: StatusFilter,
  range: { from: string; to: string }
) {
  const wantsDeposited = filter === 'deposited' || filter === 'all'
  const outstanding = useQuery({
    queryKey: [SESSIONS_KEY, 'outstanding', branchId],
    queryFn: () => getCashInTransitReport(branchId ? { branchId } : undefined),
    staleTime: 0,
  })
  const deposited = useQuery({
    queryKey: [SESSIONS_KEY, 'deposited', branchId, range],
    queryFn: () =>
      getCashInTransitHistory({
        dateFrom: range.from,
        dateTo: `${range.to}T23:59:59.999`,
        ...(branchId ? { branchId } : {}),
      }),
    enabled: wantsDeposited,
    staleTime: 0,
  })
  const accounts = useQuery({
    queryKey: ['bank-accounts-list'],
    queryFn: () => BankAccounts.list(),
  })
  const open = (outstanding.data?.data ?? []).map(fromOutstanding)
  const banked = wantsDeposited ? (deposited.data?.data ?? []).map(fromDeposited) : []
  return {
    rows: [...open, ...banked],
    accounts: accounts.data?.data ?? [],
    loading: outstanding.isLoading || (wantsDeposited && deposited.isLoading),
    capped: banked.length >= 500,
    counts: {
      to_deposit: open.filter((r) => r.status === 'to_deposit').length,
      awaiting: open.filter((r) => r.status === 'awaiting').length,
    },
  }
}

interface Selection {
  rows: LedgerRow[]
  has: (sessionId: string) => boolean
  toggle: (row: LedgerRow) => void
  toggleGroup: (group: BranchGroup) => void
  clear: () => void
}

/**
 * Selected To-deposit sessions, never spanning two branches: one deposit is
 * one branch's journal entry, so picking a row in another branch starts a
 * new selection instead of building one the server would refuse.
 */
function useSingleBranchSelection(rows: LedgerRow[]): Selection {
  const [ids, setIds] = useState<Set<string>>(new Set())
  const picked = rows.filter((r) => r.status === 'to_deposit' && ids.has(r.sessionId))
  const branchOf = picked[0]?.branchId
  return {
    rows: picked,
    has: (id) => ids.has(id),
    toggle: (row) =>
      setIds((prev) => {
        const next = new Set(row.branchId === branchOf ? prev : [])
        if (next.has(row.sessionId)) next.delete(row.sessionId)
        else next.add(row.sessionId)
        return next
      }),
    toggleGroup: (group) => {
      const selectable = group.rows.filter((r) => r.status === 'to_deposit')
      const all = selectable.every((r) => ids.has(r.sessionId))
      setIds(all ? new Set() : new Set(selectable.map((r) => r.sessionId)))
    },
    clear: () => setIds(new Set()),
  }
}

/** Head Office and the owner choose a branch, or all of them; each option
 * shows what that branch still has to bank. */
function BranchPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (branchId: string | null) => void
}): React.JSX.Element {
  const branches = useQuery({
    queryKey: ['undeposited-branches'],
    queryFn: () => getCashInTransitSummary(),
    staleTime: 0,
  })
  const options = [
    { value: '', label: 'All branches' },
    ...(branches.data?.data ?? []).map((b) => ({
      value: b.branchId,
      label: `${b.branchName} — ${fmtMoney(b.totalAmount)} · ${b.sessionCount} session${b.sessionCount === 1 ? '' : 's'}`,
    })),
  ]
  return (
    <div className="w-80">
      <SearchableSelect
        value={value ?? ''}
        onChange={(v) => onChange(v || null)}
        options={options}
        placeholder="All branches"
        loading={branches.isLoading}
      />
    </div>
  )
}

function Toolbar(props: {
  filter: StatusFilter
  onFilter: (f: StatusFilter) => void
  counts: { to_deposit: number; awaiting: number }
  range: { from: string; to: string }
  onRange: (r: { from: string; to: string }) => void
  search: string
  onSearch: (v: string) => void
}): React.JSX.Element {
  const chips: [StatusFilter, string][] = [
    ['all', 'All'],
    ['to_deposit', `To deposit (${props.counts.to_deposit})`],
    ['awaiting', `Awaiting clearing (${props.counts.awaiting})`],
    ['deposited', 'Deposited'],
  ]
  const input = 'rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs'
  const showRange = props.filter === 'deposited' || props.filter === 'all'
  return (
    <div className="mt-6 mb-2 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-xs">
        {chips.map(([key, label]) => (
          <button
            key={key}
            onClick={() => props.onFilter(key)}
            className={`rounded-md px-2.5 py-1 ${
              props.filter === key
                ? 'bg-prominent-purple-700 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {showRange && (
        <span
          className="flex items-center gap-1 text-xs text-gray-500"
          title="Deposited sessions, by the date they closed"
        >
          Closed
          <input
            type="date"
            value={props.range.from}
            onChange={(e) => props.onRange({ ...props.range, from: e.target.value })}
            className={input}
            aria-label="Closed from"
          />
          –
          <input
            type="date"
            value={props.range.to}
            onChange={(e) => props.onRange({ ...props.range, to: e.target.value })}
            className={input}
            aria-label="Closed to"
          />
        </span>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="Search branch, terminal, cashier, bank"
          aria-label="Search sessions"
          className={`${input} w-64 pl-7`}
        />
      </div>
    </div>
  )
}

/**
 * Every session as one table: a single header row, each branch a header row
 * inside it (subtotal, select-the-branch, collapse), its sessions beneath.
 */
function LedgerTable({
  groups,
  loading,
  canManage,
  selection,
  onOpenDeposit,
  empty,
}: {
  groups: BranchGroup[]
  loading: boolean
  canManage: boolean
  selection: Selection
  onOpenDeposit: (id: string) => void
  empty: string
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const columns = canManage ? 6 : 5
  const toggleCollapsed = (id: string): void =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  return (
    <div className="scroll-fade-x overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            {canManage && <th className="w-10 px-3 py-2" />}
            <th className="px-3 py-2 text-left">Terminal</th>
            <th className="px-3 py-2 text-left">Cashier</th>
            <th className="px-3 py-2 text-left">Closed</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        {loading || groups.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={columns} className="px-3 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          </tbody>
        ) : (
          groups.map((group) => (
            <BranchRows
              key={group.branchId}
              group={group}
              open={!collapsed.has(group.branchId)}
              onToggleOpen={() => toggleCollapsed(group.branchId)}
              canManage={canManage}
              selection={selection}
              onOpenDeposit={onOpenDeposit}
              columns={columns}
            />
          ))
        )}
      </table>
    </div>
  )
}

/** One branch: its header row, then its sessions when expanded. */
function BranchRows({
  group,
  open,
  onToggleOpen,
  canManage,
  selection,
  onOpenDeposit,
  columns,
}: {
  group: BranchGroup
  open: boolean
  onToggleOpen: () => void
  canManage: boolean
  selection: Selection
  onOpenDeposit: (id: string) => void
  columns: number
}): React.JSX.Element {
  const selectable = group.rows.filter((r) => r.status === 'to_deposit')
  const allPicked = selectable.length > 0 && selectable.every((r) => selection.has(r.sessionId))
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <tbody className="divide-y divide-gray-100 border-t border-gray-200">
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
        <td colSpan={columns - (canManage ? 2 : 1)} className="px-3 py-2">
          <button onClick={onToggleOpen} className="flex items-center gap-2 text-left">
            <Chevron className="h-4 w-4 text-gray-400" />
            <span className="font-semibold text-gray-900">{group.branchName}</span>
            <span className="text-xs text-gray-500">
              {group.rows.length} session{group.rows.length === 1 ? '' : 's'}
              {group.receipts.length > 0 &&
                ` · ${group.receipts.length} New Receipt${group.receipts.length === 1 ? '' : 's'}`}
            </span>
          </button>
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(group.total)}</td>
      </tr>
      {open &&
        group.rows.map((r) => (
          <SessionRow
            key={r.sessionId}
            row={r}
            canManage={canManage}
            selection={selection}
            onOpenDeposit={onOpenDeposit}
          />
        ))}
      {open &&
        group.receipts.map((r) => <ReceiptRow key={r.id} receipt={r} canManage={canManage} />)}
    </tbody>
  )
}

/** An unbanked New Receipt the branch has no To-deposit session for. Not
 * tickable: recording the branch's deposit takes it in automatically. */
function ReceiptRow({
  receipt,
  canManage,
}: {
  receipt: AcknowledgementReceipt
  canManage: boolean
}): React.JSX.Element {
  return (
    <tr>
      {canManage && <td className="px-3 py-2" />}
      <td className="px-3 py-2">{receipt.number ?? 'New Receipt'}</td>
      <td className="px-3 py-2">{receipt.payerName}</td>
      <td className="px-3 py-2 text-xs">{fmtDate(receipt.paymentDate)}</td>
      <td className="px-3 py-2">
        <span className="text-xs text-gray-500">To deposit · New Receipt</span>
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(Number(receipt.amount ?? 0))}</td>
    </tr>
  )
}

/** A To-deposit row ticks; any other row opens the deposit it is in. */
function SessionRow({
  row,
  canManage,
  selection,
  onOpenDeposit,
}: {
  row: LedgerRow
  canManage: boolean
  selection: Selection
  onOpenDeposit: (id: string) => void
}): React.JSX.Element {
  const pickable = canManage && row.status === 'to_deposit'
  const opens = row.status !== 'to_deposit' && !!row.depositId
  const onClick = pickable
    ? () => selection.toggle(row)
    : opens
      ? () => onOpenDeposit(row.depositId as string)
      : undefined
  return (
    <tr onClick={onClick} className={`hover:bg-gray-50 ${onClick ? 'cursor-pointer' : ''}`}>
      {canManage && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          {pickable && (
            <input
              type="checkbox"
              checked={selection.has(row.sessionId)}
              onChange={() => selection.toggle(row)}
              aria-label="Select session"
            />
          )}
        </td>
      )}
      <td className="px-3 py-2">{row.terminalCode ?? '—'}</td>
      <td className="px-3 py-2">{row.cashierName ?? '—'}</td>
      <td className="px-3 py-2 text-xs">{fmtDate(row.closedAt)}</td>
      <td className="px-3 py-2">
        <StatusCell row={row} />
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(row.amount)}</td>
    </tr>
  )
}

/** To deposit; Awaiting · date · waiting days (amber, red after three days);
 * Deposited · date. No bank: a deposit goes to several, one per slip, and the
 * stored one is only the first slip's. */
function StatusCell({ row }: { row: LedgerRow }): React.JSX.Element {
  if (row.status === 'to_deposit') {
    return <span className="text-xs text-gray-500">To deposit</span>
  }
  const where = row.depositDate ? fmtDate(row.depositDate) : ''
  if (row.status === 'deposited') {
    return (
      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
        Deposited{where ? ` · ${where}` : ''}
      </span>
    )
  }
  const days = row.depositDate ? daysSince(row.depositDate) : 0
  const tone =
    days >= 3
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-800'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tone}`}>
      Awaiting{where ? ` · ${where}` : ''}
      {days > 0 ? ` · ${days} day${days === 1 ? '' : 's'}` : ''}
    </span>
  )
}

/** The page at a glance: what is still to bank, what is waiting on
 * accounting, and what was banked lately — for the branch in view. */
function SummaryCards({
  rows,
  branchId,
}: {
  rows: LedgerRow[]
  branchId: string | null
}): React.JSX.Element {
  const summary = useDepositSummary(branchId).data?.data
  const receipts = useUnbankedReceipts(branchId).data?.data ?? []
  const toDeposit = rows.filter((r) => r.status === 'to_deposit')
  const undeposited =
    toDeposit.reduce((sum, r) => sum + r.amount, 0) +
    receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SummaryCard
        label="Undeposited"
        amount={undeposited}
        note={`${plural(toDeposit.length, 'session')}${
          receipts.length ? ` and ${plural(receipts.length, 'New Receipt')}` : ''
        } to deposit`}
        tone="text-amber-700"
      />
      <SummaryCard
        label="Awaiting clearing"
        amount={summary?.awaitingClearing.amount ?? 0}
        note={`${plural(summary?.awaitingClearing.count ?? 0, 'deposit')} with accounting`}
        tone="text-prominent-purple-800"
      />
      <SummaryCard
        label={`Cleared · last ${summary?.clearedRecent.days ?? 30} days`}
        amount={summary?.clearedRecent.amount ?? 0}
        note={`${plural(summary?.clearedRecent.count ?? 0, 'deposit')} posted`}
        tone="text-green-700"
      />
    </div>
  )
}

function SummaryCard({
  label,
  amount,
  note,
  tone,
}: {
  label: string
  amount: number
  note: string
  tone: string
}): React.JSX.Element {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{fmtMoney(amount)}</p>
      <p className="text-xs text-gray-500">{note}</p>
    </div>
  )
}

interface Slip {
  bankAccountId: string
  /** A string, and empty on open — the client asked for the amount field to
   * start blank so accounting itemises the banks rather than accepting a
   * figure the system worked out (Scenario 70 G12). */
  amount: string
  /** A processor's clearing account; empty means the branch's own cash. */
  clearsAccountId: string
  note: string
  /** This bank's own deposit slip number — each bank issues its own. */
  reference: string
}

/** The slips' own numbers, joined — the deposit's reference, capped at the
 * 100 characters it is stored in. */
function joinReferences(refs: (string | undefined)[]): string | undefined {
  const unique = [...new Set(refs.filter((r): r is string => !!r))]
  return unique.length ? unique.join(', ').slice(0, 100) : undefined
}

type Option = { value: string; label: string }

/** One slip: the account it empties, the amount on it, the bank it went to,
 * and that bank's own slip number. A cheque from a New Receipt is entered the
 * same way, clearing 1-01-010. */
function SlipRow({
  slip,
  label,
  bankOptions,
  clearingOptions,
  onChange,
  onRemove,
  removeDisabled = false,
}: {
  slip: Slip
  /** Names the row for screen readers and the remove tooltip. */
  label: string
  bankOptions: Option[]
  clearingOptions: Option[]
  onChange: (patch: Partial<Slip>) => void
  onRemove: () => void
  removeDisabled?: boolean
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_1fr_12rem_auto]">
      <SearchableSelect
        value={slip.clearsAccountId}
        // Cleared back to the branch's cash rather than to nothing.
        onChange={(value) => onChange({ clearsAccountId: value || BRANCH_CASH })}
        options={[{ value: BRANCH_CASH, label: BRANCH_CASH_LABEL }, ...clearingOptions]}
        placeholder={BRANCH_CASH_LABEL}
        portal
      />
      <input
        inputMode="decimal"
        value={slip.amount}
        onChange={(e) => onChange({ amount: e.target.value })}
        placeholder="Amount"
        aria-label={`${label} amount`}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right font-mono text-sm tabular-nums"
      />
      <SearchableSelect
        value={slip.bankAccountId}
        onChange={(value) => onChange({ bankAccountId: value })}
        options={bankOptions}
        placeholder="Bank account…"
        clearable
        portal
      />
      <input
        value={slip.reference}
        onChange={(e) => onChange({ reference: e.target.value })}
        placeholder="Reference number"
        aria-label={`${label} reference`}
        maxLength={100}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      <Tooltip label={`Remove ${label}`}>
        <button
          type="button"
          onClick={onRemove}
          disabled={removeDisabled}
          aria-label={`Remove ${label}`}
          className="px-2 text-gray-400 hover:text-red-600 disabled:opacity-30"
        >
          <X className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

/** The branch's own cash — 1-01-010, what POS_CASH maps to. A value of its
 * own so the dropdown shows it as chosen (an empty value reads as nothing
 * picked); sent as no clearsAccountId, which is what the deposit's cash
 * figure counts. */
const BRANCH_CASH = 'branch-cash'
const BRANCH_CASH_LABEL = '1-01-010 — Cash and Cash Equivalents'

/** The processor's clearing account a slip empties, or undefined for the
 * branch's own cash. */
function clearsAccountOf(slip: Slip): string | undefined {
  return slip.clearsAccountId && slip.clearsAccountId !== BRANCH_CASH
    ? slip.clearsAccountId
    : undefined
}

/** The client's chart groups every processor's holding account under one
 * header (prisma/data/chart-of-accounts.csv): GCash, Maya, Card/POS, ECPay,
 * Palawan, other gateways, transfers in transit, online bank transfers. */
const CLEARING_GROUP = '1-01-040'
/** Narrows the account search to the group's own number range. */
const CLEARING_GROUP_PREFIX = '1-01-04'

/** CLEARING_GROUP and the accounts filed under it (the client's chart, rows
 * 5–13), as dropdown options — nothing another chart left behind. */
function clearingAccountOptions(data: unknown): Option[] {
  // `/accounts` answers with a bare array, not the paginated shape its type
  // claims, and includes each account's parent.
  const accounts = (
    Array.isArray(data) ? data : ((data as { items?: unknown[] } | undefined)?.items ?? [])
  ) as (Account & { parentAccount?: { number?: string } | null })[]
  return accounts
    .filter((a) => a.number === CLEARING_GROUP || a.parentAccount?.number === CLEARING_GROUP)
    .sort((a, b) => (a.number ?? '').localeCompare(b.number ?? ''))
    .map((a) => ({ value: a.id, label: a.number ? `${a.number} — ${a.name}` : a.name }))
}

/** Centavos, so a tally of typed amounts cannot drift into 0.004 differences. */
const round2 = (n: number): number => Math.round(n * 100) / 100

const EMPTY_SLIP: Slip = {
  bankAccountId: '',
  amount: '',
  clearsAccountId: BRANCH_CASH,
  note: '',
  reference: '',
}

function DepositForm({
  accounts,
  sessions,
  branchId,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  sessions: LedgerRow[]
  branchId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    // Local date, not UTC: toISOString() is a day behind for the first eight
    // hours of every Manila morning, so the deposit opened with yesterday's
    // date on it and posted there unless somebody noticed.
    depositDate: new Date().toLocaleDateString('en-CA'),
  })
  const [slips, setSlips] = useState<Slip[]>([{ ...EMPTY_SLIP }])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The branch's New Receipts still to be banked — money taken at the counter
  // against no sale, which sits in the branch's cash like any collection
  // (Scenario 70 G11). Banked with the day, so always part of this deposit;
  // accounting enters a cheque like any other bank, on a slip of its own.
  const newReceipts = useUnbankedReceipts(branchId, !!branchId)
  const receipts = newReceipts.data?.data ?? []

  // The chart, for the "clears" column: a slip either empties the branch's
  // own cash or one of the accounts the client's chart files under 1-01-040
  // Payment Gateway and Collection Clearing Funds.
  const chart = useQuery({
    queryKey: ['deposit-clearing-accounts'],
    queryFn: () => getAccounts({ search: CLEARING_GROUP_PREFIX }),
    staleTime: 5 * 60_000,
  })
  const clearingOptions = clearingAccountOptions(chart.data?.data)

  const receiptsTotal = receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  /** What the branch's own cash and cheques come to. */
  const outstanding = round2(sessions.reduce((sum, s) => sum + s.cash, 0) + receiptsTotal)
  const slipAmount = (slip: Slip): number => Number(slip.amount) || 0
  const cashSlips = round2(
    slips.filter((s) => !clearsAccountOf(s)).reduce((sum, s) => sum + slipAmount(s), 0)
  )
  const difference = round2(outstanding - cashSlips)
  const incomplete = slips.some((s) => !s.bankAccountId || slipAmount(s) <= 0)
  // Why Record deposit is disabled, so the button never just sits greyed out.
  const blockedReason =
    sessions.length === 0
      ? 'Select at least one session to deposit.'
      : incomplete
        ? 'Every slip needs a bank account and an amount — remove any empty slip.'
        : null
  // Not a block: the amounts are accounting's own itemisation. Said on hover
  // so an over or short is a choice, not a typo nobody saw.
  const cashNote =
    Math.abs(difference) >= 0.005
      ? `The 1-01-010 slips come to ${fmtMoney(cashSlips)} against ${fmtMoney(outstanding)} collected — ${fmtMoney(Math.abs(difference))} ${difference > 0 ? 'short' : 'over'}.`
      : null
  const bankOptions = accounts.map((a) => ({
    value: a.id,
    label: a.accountNumber ? `${a.name} — ${a.accountNumber}` : a.name,
  }))

  const setSlip = (i: number, patch: Partial<Slip>) =>
    setSlips((prev) => prev.map((s, n) => (n === i ? { ...s, ...patch } : s)))

  // Scenario 61 Part 5 — records a DRAFT; nothing posts until accounting has
  // checked the attachments and clears it from the Deposits view.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const lines = slips.map((s) => ({
      bankAccountId: s.bankAccountId,
      amount: slipAmount(s),
      clearsAccountId: clearsAccountOf(s),
      note: s.note || undefined,
      reference: s.reference.trim() || undefined,
    }))
    const res = await createPosDeposit({
      bankAccountId: lines[0].bankAccountId,
      sessionIds: sessions.map((s) => s.sessionId),
      newReceiptIds: receipts.map((r) => r.id),
      lines,
      depositDate: form.depositDate,
      // The deposit's own reference — what the list searches and the Daily
      // Collection Report prints — is the slips' numbers together.
      reference: joinReferences(lines.map((l) => l.reference)),
    })
    if (!res.success || !res.data) {
      setSaving(false)
      setError(res.error || res.message || 'Failed to record the deposit')
      return
    }
    const failed = await uploadAndAttach(POS_DEPOSIT_ENTITY, res.data.id, files)
    setSaving(false)
    showToast(
      failed
        ? {
            title: 'Deposit recorded — some files did not attach',
            description: `${failed} file(s) failed. Open it under Deposits to attach them again.`,
            status: 'warning',
          }
        : {
            title: 'Deposit recorded',
            description: 'Awaiting clearing by accounting.',
            status: 'success',
          }
    )
    onSaved()
  }

  return (
    <div className="absolute inset-0 z-40 flex bg-white">
      {/* Fills the content area (the layout's `main` frame), leaving the side
          and top navigation in view: one slip per bank needs the room. Header
          and footer stay put; only the middle scrolls, so however many files
          are attached the Record deposit button is never pushed out of view. */}
      <div className="flex h-full w-full flex-col bg-white">
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">Record deposit</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            <DepositSessions sessions={sessions} />

            {/* Scenario 70 G12 — one row per bank, each saying what it empties.
                The client's own closing goes to five banks at once and clears
                the branch's cash and every processor's account in one record;
                the amount starts blank so accounting itemises it rather than
                accepting a figure worked out for them. */}
            <div className="rounded-lg border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Slips</p>
                <button
                  type="button"
                  onClick={() => setSlips((prev) => [...prev, { ...EMPTY_SLIP }])}
                  className="text-xs font-medium text-prominent-purple-700 hover:underline"
                >
                  Add slip
                </button>
              </div>
              <div className="space-y-3 p-3">
                {slips.map((slip, i) => (
                  <SlipRow
                    key={i}
                    slip={slip}
                    label={`slip ${i + 1}`}
                    bankOptions={bankOptions}
                    clearingOptions={clearingOptions}
                    onChange={(patch) => setSlip(i, patch)}
                    onRemove={() => setSlips((prev) => prev.filter((_, n) => n !== i))}
                    removeDisabled={slips.length === 1}
                  />
                ))}
              </div>
            </div>

            <label className="block sm:w-1/2">
              <span className="block text-xs font-medium text-gray-600 mb-1">Deposit Date *</span>
              <input
                required
                type="date"
                value={form.depositDate}
                onChange={(e) => setForm({ ...form, depositDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </label>
            <AttachmentsPanel
              entityType={POS_DEPOSIT_ENTITY}
              title="Proof of deposit"
              description="Deposit slip, check images, transfer screenshots."
              staged={files}
              onStagedChange={setFiles}
            />
            {sessions.length === 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                No sessions selected. Close this, tick the sessions to deposit, and try again.
              </div>
            )}
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            {/* A disabled button gets no hover of its own, so it lets the
                pointer through to the tooltip's wrapper and the reason shows. */}
            <Tooltip
              label={blockedReason ?? cashNote ?? 'Save this deposit as a draft for accounting'}
              align="end"
            >
              <button
                type="submit"
                disabled={saving || blockedReason !== null}
                className="px-4 py-2 text-sm font-semibold bg-purple-700 text-white rounded-lg disabled:pointer-events-none disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Record deposit'}
              </button>
            </Tooltip>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Which sessions are being banked — named, not totalled. The client's "Note
 * to Warp" points here: no worked-out figure, so accounting itemises each
 * bank and its amount on the slips instead (Scenario 70 G12).
 */
function DepositSessions({ sessions }: { sessions: LedgerRow[] }): React.JSX.Element | null {
  if (sessions.length === 0) return null
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
        {sessions[0].branchName} · {sessions.length} session{sessions.length === 1 ? '' : 's'}
      </div>
      <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto text-sm">
        {sessions.map((s) => (
          <li key={s.sessionId} className="truncate px-3 py-1.5 text-gray-700">
            {s.terminalCode ?? 'Terminal'} · {s.cashierName ?? 'Cashier'} · closed{' '}
            {fmtDate(s.closedAt)}
          </li>
        ))}
      </ul>
    </div>
  )
}
