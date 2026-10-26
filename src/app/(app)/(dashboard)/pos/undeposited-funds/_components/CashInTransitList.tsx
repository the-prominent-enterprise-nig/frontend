'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
import AttachmentsPanel, { uploadAndAttach } from '@/src/components/common/AttachmentsPanel'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import Tooltip from '@/src/components/ui/Tooltip'
import { showToast } from '@/src/components/ui/toast'
import { createPosDeposit, listPosDeposits, type PosDeposit } from '../_actions/pos-deposits'
import {
  SlipEditor,
  isBranchCashSlip,
  earliestDate,
  emptySlip,
  joinReferences,
  round2,
  slipAmount,
  slipsProblem,
  toLineInputs,
  type Slip,
} from './SlipEditor'
import {
  DepositDetailLoader,
  POS_DEPOSIT_ENTITY,
  refreshDeposits,
  useDepositSummary,
} from './PosDepositsView'

const SESSIONS_KEY = 'undeposited-sessions'
const NEW_RECEIPTS_KEY = 'unbanked-new-receipts'

/** The branch's New Receipts still to be banked — or every branch's, for no
 * branch. Money taken at the counter against no sale, banked with the day.
 * Each one's `amount` is what is left of it after any short deposit. */
function useUnbankedReceipts(branchId: string | null, enabled = true) {
  return useQuery({
    queryKey: [NEW_RECEIPTS_KEY, branchId],
    queryFn: () =>
      AcknowledgementReceipts.list({ branchId: branchId ?? undefined, unbanked: 'true' }),
    select: (res) => ({ ...res, data: res.data?.map(leftOfReceipt) }),
    enabled,
    staleTime: 0,
  })
}

function leftOfReceipt(r: AcknowledgementReceipt): AcknowledgementReceipt {
  return { ...r, amount: round2(Number(r.amount ?? 0) - Number(r.depositedAmount ?? 0)) }
}

/** Where a session's cash is: still to bank, in a deposit waiting on
 * accounting, or banked. */
type LedgerStatus = 'to_deposit' | 'awaiting' | 'deposited'
type StatusFilter = LedgerStatus | 'all'

/** One row of the Undeposited Funds table — a session, wherever it is. A
 * session a deposit took only part of has a row for what is still to deposit
 * and one per draft holding the rest. */
interface LedgerRow {
  /** Unique per row: the session, or the session and the draft holding it. */
  key: string
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
  /** What earlier deposits already banked of a To-deposit session — a short
   * deposit leaves the rest here, still to deposit. */
  deposited: number
  status: LedgerStatus
  /** The deposit it is in, when it is in one with a record. */
  depositId: string | null
  /** On a Partially deposited row, the latest posted deposit that banked part
   * of it — opened to check or correct it. */
  bankedDepositId: string | null
  bankName: string | null
  depositDate: string | null
}

/** The group a session is listed and deposited under: its caravan, when its
 * register stands at one, else its branch. A caravan's cash posts under the
 * host, but it is deposited on its own. */
function groupOfSession(
  r: Pick<CashInTransitSessionRow, 'branchId' | 'branchName' | 'caravanBranchId' | 'caravanName'>
): Pick<LedgerRow, 'branchId' | 'branchName'> {
  if (r.caravanBranchId) {
    return {
      branchId: r.caravanBranchId,
      branchName: `${r.caravanName ?? 'Caravan'} — caravan of ${r.branchName ?? 'its host'}`,
    }
  }
  return { branchId: r.branchId ?? 'none', branchName: r.branchName ?? 'No branch' }
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

/** A session still in the drawer: what is left to deposit, if anything, and
 * a row per draft waiting on accounting for part of it. */
function fromOutstanding(r: CashInTransitSessionRow): LedgerRow[] {
  const base = {
    sessionId: r.sessionId,
    ...groupOfSession(r),
    terminalCode: r.terminalCode,
    cashierName: r.cashierName,
    closedAt: r.closedAt,
  }
  // An older API sends only the one draft, holding the session whole.
  const pending =
    r.pendingDeposits ??
    (r.pendingDeposit
      ? [{ ...r.pendingDeposit, amount: r.amount + Number(r.clearingAmount ?? 0) }]
      : [])
  const left = r.pendingDeposits ? Number(r.amount) + Number(r.clearingAmount ?? 0) : 0
  const toDeposit: LedgerRow[] =
    left > 0.005 || pending.length === 0
      ? [
          {
            ...base,
            key: r.sessionId,
            ...amounts(r.amount, r.clearingAmount, r.newReceiptsAmount),
            deposited: Number(r.depositedAmount ?? 0),
            status: 'to_deposit',
            depositId: null,
            bankedDepositId: r.bankedDeposits?.[0]?.id ?? null,
            // A Partially deposited row: when the latest deposit that banked
            // part of it went in. Empty while nothing is banked yet.
            bankName: r.bankedDeposits?.[0]?.bankName ?? null,
            depositDate: r.bankedDeposits?.[0]?.depositDate ?? null,
          },
        ]
      : []
  return [
    ...toDeposit,
    ...pending.map(
      (p): LedgerRow => ({
        ...base,
        key: `${r.sessionId}:${p.id}`,
        ...amounts(p.amount, 0, 0),
        deposited: 0,
        status: 'awaiting',
        depositId: p.id,
        bankedDepositId: null,
        bankName: p.bankName,
        depositDate: p.depositDate,
      })
    ),
  ]
}

/** A draft of New Receipts alone — no session to hang its row on. */
function fromReceiptsDraft(d: PosDeposit): LedgerRow {
  return {
    key: d.id,
    sessionId: d.id,
    branchId: d.branchId,
    branchName: d.branchName ?? 'No branch',
    terminalCode: 'New Receipts',
    cashierName: d.newReceipts?.map((r) => r.number ?? r.payerName).join(', ') ?? null,
    closedAt: d.createdAt,
    ...amounts(Number(d.amount), 0, 0),
    deposited: 0,
    status: 'awaiting',
    depositId: d.id,
    bankedDepositId: null,
    bankName: d.bankAccount.name,
    depositDate: d.depositDate,
  }
}

function fromDeposited(r: CashInTransitHistoryRow): LedgerRow {
  return {
    key: `${r.sessionId}:deposited`,
    sessionId: r.sessionId,
    ...groupOfSession(r),
    terminalCode: r.terminalCode,
    cashierName: r.cashierName,
    closedAt: r.closedAt,
    ...amounts(r.amount, r.clearingAmount, r.newReceiptsAmount),
    deposited: 0,
    status: 'deposited',
    depositId: r.posDepositId,
    bankedDepositId: null,
    bankName: r.depositedTo,
    depositDate: r.depositDate ?? r.citClearedAt,
  }
}

/** A To-deposit session a short deposit already banked some of. */
const isPartial = (r: LedgerRow): boolean => r.status === 'to_deposit' && r.deposited > 0

function statusText(r: LedgerRow): string {
  return isPartial(r) ? 'Partially deposited' : STATUS_TEXT[r.status]
}

/** What a row has already banked: a Deposited session in full, and what
 * earlier deposits took of one still To deposit. A draft has posted nothing. */
function depositedOf(r: LedgerRow): number {
  if (r.status === 'deposited') return r.amount
  return r.status === 'to_deposit' ? r.deposited : 0
}

/** A money cell that reads "—" for nothing, so the eye finds the real figures. */
function MoneyOrDash({ amount }: { amount: number }): React.JSX.Element {
  return amount > 0.005 ? <>{fmtMoney(amount)}</> : <span className="text-gray-400">—</span>
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
    'Deposited',
    'Amount',
  ]
  const dataRows = rows.map((r) => [
    r.branchName,
    r.terminalCode ?? '',
    r.cashierName ?? '',
    fmtDate(r.closedAt),
    statusText(r),
    r.bankName ?? '',
    r.depositDate ? fmtDate(r.depositDate) : '',
    depositedOf(r),
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
    else extra.set(host.key, (extra.get(host.key) ?? 0) + Number(receipt.amount ?? 0))
  }
  return {
    rows: rows.map((r) =>
      extra.has(r.key) ? { ...r, amount: r.amount + (extra.get(r.key) ?? 0) } : r
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
 * grouped by branch, with where its cash is: To deposit → Deposited. Tick To-deposit sessions to record a deposit; click any other
 * row to open its deposit (proof, Clear, Cancel). Head Office and the owner
 * pick a branch (or all); a branch-assigned user is held to their own.
 */
export function CashInTransitList({
  canManage,
  canVerify = false,
  canCorrect = false,
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
  /** May correct a posted deposit the cashier mistyped: accounting. */
  canCorrect?: boolean
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
  // The sessions being deposited, and their branch — which is all there is
  // for a deposit of New Receipts alone.
  const [depositing, setDepositing] = useState<{
    sessions: LedgerRow[]
    branchId: string
    branchName: string
  } | null>(null)
  const depositSelection = (): void => {
    const first = selection.rows[0]
    if (!first) return
    setDepositing({
      sessions: selection.rows,
      branchId: first.branchId,
      branchName: first.branchName,
    })
  }
  // A journal entry's amount links here with ?deposit=<id>, opening that
  // deposit; closing it takes the id back out of the address.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openDepositId, setOpenDepositId] = useState<string | null>(searchParams.get('deposit'))

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
              onClick={depositSelection}
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
        onDepositReceipts={(group) =>
          setDepositing({ sessions: [], branchId: group.branchId, branchName: group.branchName })
        }
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
          sessions={depositing.sessions}
          branchId={depositing.branchId}
          branchName={depositing.branchName}
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
          accounts={ledger.accounts}
          canManage={canManage}
          canVerify={canVerify}
          canCorrect={canCorrect}
          onClose={() => {
            setOpenDepositId(null)
            if (searchParams.get('deposit')) router.replace(pathname)
          }}
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
  const drafts = useQuery({
    queryKey: [SESSIONS_KEY, 'drafts', branchId],
    queryFn: () =>
      listPosDeposits({ status: 'draft', pageSize: 100, ...(branchId ? { branchId } : {}) }),
    staleTime: 0,
  })
  const accounts = useQuery({
    queryKey: ['bank-accounts-list'],
    queryFn: () => BankAccounts.list(),
  })
  const sessionRows = (outstanding.data?.data ?? []).flatMap(fromOutstanding)
  // Drafts holding no session — New Receipts alone — get a row of their own.
  const onSessions = new Set(sessionRows.map((r) => r.depositId))
  const open = [
    ...sessionRows,
    ...(drafts.data?.data?.items ?? [])
      .filter((d) => d.sessions.length === 0 && !onSessions.has(d.id))
      .map(fromReceiptsDraft),
  ]
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
    ['deposited', 'Deposited'],
  ]
  // One height for the tabs, the dates and the search, so the row lines up.
  const input = 'h-9 rounded-lg border border-gray-200 px-2.5 text-sm'
  const showRange = props.filter === 'deposited' || props.filter === 'all'
  return (
    <div className="mt-6 mb-2 flex flex-wrap items-center gap-2">
      <div className="flex h-9 gap-1 rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
        {chips.map(([key, label]) => (
          <button
            key={key}
            onClick={() => props.onFilter(key)}
            className={`rounded-md px-3 ${
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
          className="flex items-center gap-1.5 text-sm text-gray-500"
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
      {/* Takes the toolbar's spare room, so the placeholder reads in full;
          wraps to its own line on a narrow screen. */}
      <div className="relative min-w-64 max-w-md flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={props.search}
          onChange={(e) => props.onSearch(e.target.value)}
          placeholder="Search branch, terminal, cashier, bank"
          aria-label="Search sessions"
          className={`${input} w-full pl-8 pr-3`}
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
  onDepositReceipts,
  empty,
}: {
  groups: BranchGroup[]
  loading: boolean
  canManage: boolean
  selection: Selection
  onOpenDeposit: (id: string) => void
  onDepositReceipts: (group: BranchGroup) => void
  empty: string
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const columns = canManage ? 8 : 7
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
            <th className="px-3 py-2 text-left">Deposit date</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Deposited</th>
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
              onDepositReceipts={() => onDepositReceipts(group)}
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
  onDepositReceipts,
  columns,
}: {
  group: BranchGroup
  open: boolean
  onToggleOpen: () => void
  canManage: boolean
  selection: Selection
  onOpenDeposit: (id: string) => void
  onDepositReceipts: () => void
  columns: number
}): React.JSX.Element {
  const selectable = group.rows.filter((r) => r.status === 'to_deposit')
  // New Receipts with no session left to ride on — what a short deposit
  // left unbanked — are deposited on their own.
  const receiptsAlone = canManage && selectable.length === 0 && group.receipts.length > 0
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
        <td colSpan={columns - (canManage ? 3 : 2)} className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button onClick={onToggleOpen} className="flex items-center gap-2 text-left">
              <Chevron className="h-4 w-4 text-gray-400" />
              <span className="font-semibold text-gray-900">{group.branchName}</span>
              <span className="text-xs text-gray-500">
                {group.rows.length} session{group.rows.length === 1 ? '' : 's'}
                {group.receipts.length > 0 &&
                  ` · ${group.receipts.length} New Receipt${group.receipts.length === 1 ? '' : 's'}`}
              </span>
            </button>
            {receiptsAlone && (
              <button
                onClick={onDepositReceipts}
                className="flex items-center gap-1.5 rounded-lg border border-purple-200 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-50"
              >
                <Landmark className="h-3.5 w-3.5" /> Record deposit
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">
          <MoneyOrDash amount={group.rows.reduce((sum, r) => sum + depositedOf(r), 0)} />
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtMoney(group.total)}</td>
      </tr>
      {open &&
        group.rows.map((r) => (
          <SessionRow
            key={r.key}
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
      <td className="px-3 py-2 text-xs text-gray-400">—</td>
      <td className="px-3 py-2">
        {Number(receipt.depositedAmount ?? 0) > 0 ? (
          <PartialChip banked={Number(receipt.depositedAmount)} />
        ) : (
          <span className="text-xs text-gray-500">To deposit · New Receipt</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <MoneyOrDash amount={Number(receipt.depositedAmount ?? 0)} />
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(Number(receipt.amount ?? 0))}</td>
    </tr>
  )
}

/** A To-deposit row ticks; any other row opens the deposit it is in. A
 * Partially deposited one opens the deposit that banked part of it — from the
 * row for whoever cannot tick it, from its chip for whoever can. */
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
  const opensId = row.status === 'to_deposit' ? row.bankedDepositId : row.depositId
  const onClick = pickable
    ? () => selection.toggle(row)
    : opensId
      ? () => onOpenDeposit(opensId)
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
      <td className="whitespace-nowrap px-3 py-2 text-xs">
        {row.depositDate ? fmtDate(row.depositDate) : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2">
        <StatusCell row={row} onOpenDeposit={onOpenDeposit} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <MoneyOrDash amount={depositedOf(row)} />
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(row.amount)}</td>
    </tr>
  )
}

/** To deposit, Awaiting or Deposited — the status only; the date has its own
 * column. No bank: a deposit goes to several, one per slip, and the stored
 * one is only the first slip's. */
function StatusCell({
  row,
  onOpenDeposit,
}: {
  row: LedgerRow
  onOpenDeposit: (id: string) => void
}): React.JSX.Element {
  // Still To deposit (it filters and ticks as one), but a short deposit
  // banked some of it: the amount is what is left.
  if (isPartial(row)) {
    const id = row.bankedDepositId
    return <PartialChip banked={row.deposited} onOpen={id ? () => onOpenDeposit(id) : undefined} />
  }
  if (row.status === 'to_deposit') {
    return <span className="text-xs text-gray-500">To deposit</span>
  }
  if (row.status === 'deposited') {
    return (
      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
        Deposited
      </span>
    )
  }
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
      Awaiting
    </span>
  )
}

/** Partially deposited, with how much is already in deposits on hover — a
 * button opening that deposit when it has one. */
function PartialChip({
  banked,
  onOpen,
}: {
  banked: number
  onOpen?: () => void
}): React.JSX.Element {
  const chip =
    'whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800'
  const left = `${fmtMoney(banked)} already deposited — the amount shown is what is left`
  return (
    <Tooltip label={onOpen ? `${left}. Click to open that deposit.` : left}>
      {onOpen ? (
        <button
          type="button"
          onClick={(e) => {
            // Not a tick: the row's own click selects it for a new deposit.
            e.stopPropagation()
            onOpen()
          }}
          className={`${chip} hover:bg-blue-100`}
        >
          Partially deposited
        </button>
      ) : (
        <span className={chip}>Partially deposited</span>
      )}
    </Tooltip>
  )
}

/** The page at a glance: what is still to bank and what was banked lately —
 * for the branch in view. */
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
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SummaryCard
        label="Undeposited"
        amount={undeposited}
        note={`${plural(toDeposit.length, 'session')}${
          receipts.length ? ` and ${plural(receipts.length, 'New Receipt')}` : ''
        } to deposit`}
        tone="text-amber-700"
      />
      <SummaryCard
        label={`Deposited · last ${summary?.clearedRecent.days ?? 30} days`}
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

function DepositForm({
  accounts,
  sessions,
  branchId,
  branchName,
  onClose,
  onSaved,
}: {
  accounts: BankAccount[]
  sessions: LedgerRow[]
  branchId: string
  branchName: string
  onClose: () => void
  onSaved: () => void
}) {
  const [slips, setSlips] = useState<Slip[]>(() => [emptySlip()])
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The branch's New Receipts still to be banked — money taken at the counter
  // against no sale, which sits in the branch's cash like any collection
  // (Scenario 70 G11). Banked with the day, so always part of this deposit;
  // accounting enters a cheque like any other bank, on a slip of its own.
  const newReceipts = useUnbankedReceipts(branchId)
  const receipts = newReceipts.data?.data ?? []

  const receiptsTotal = receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
  /** What the branch's own cash and cheques come to. */
  const outstanding = round2(sessions.reduce((sum, s) => sum + s.cash, 0) + receiptsTotal)
  const cashSlips = round2(
    slips.filter(isBranchCashSlip).reduce((sum, s) => sum + slipAmount(s), 0)
  )
  const difference = round2(outstanding - cashSlips)
  // Why Record deposit is disabled, so the button never just sits greyed out.
  const blockedReason =
    sessions.length === 0 && receipts.length === 0
      ? 'Select at least one session to deposit.'
      : slipsProblem(slips)
  // Not a block: the amounts are accounting's own itemisation. Said on hover
  // so an over or short is a choice, not a typo nobody saw.
  const cashNote =
    Math.abs(difference) >= 0.005
      ? `The 1-01-010 slips come to ${fmtMoney(cashSlips)} against ${fmtMoney(outstanding)} collected — ${fmtMoney(Math.abs(difference))} ${difference > 0 ? 'short' : 'over'}.`
      : null

  // Posts at once: every slip carries the bank's own reference number, so the
  // money is already in the bank and there is nothing left to clear.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const lines = toLineInputs(slips)
    const res = await createPosDeposit({
      bankAccountId: lines[0].bankAccountId,
      sessionIds: sessions.map((s) => s.sessionId),
      newReceiptIds: receipts.map((r) => r.id),
      lines,
      depositDate: earliestDate(slips),
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
            description: 'Posted to the bank.',
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
            <DepositSessions sessions={sessions} branchName={branchName} receipts={receipts} />

            <SlipEditor slips={slips} onChange={setSlips} accounts={accounts} />

            <AttachmentsPanel
              entityType={POS_DEPOSIT_ENTITY}
              title="Proof of deposit"
              description="Deposit slip, check images, transfer screenshots."
              staged={files}
              onStagedChange={setFiles}
            />
            {sessions.length === 0 && receipts.length === 0 && (
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
              label={blockedReason ?? cashNote ?? 'Record and post this deposit'}
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
 * Which sessions and New Receipts are being banked — named, not totalled. The
 * client's "Note to Warp" points here: no worked-out figure, so accounting
 * itemises each bank and its amount on the slips instead (Scenario 70 G12).
 */
function DepositSessions({
  sessions,
  branchName,
  receipts,
}: {
  sessions: LedgerRow[]
  branchName: string
  receipts: AcknowledgementReceipt[]
}): React.JSX.Element | null {
  if (sessions.length === 0 && receipts.length === 0) return null
  const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
        {branchName} · {plural(sessions.length, 'session')}
        {receipts.length > 0 && ` · ${plural(receipts.length, 'New Receipt')}`}
      </div>
      <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto text-sm">
        {sessions.map((s) => (
          <li key={s.sessionId} className="truncate px-3 py-1.5 text-gray-700">
            {s.terminalCode ?? 'Terminal'} · {s.cashierName ?? 'Cashier'} · closed{' '}
            {fmtDate(s.closedAt)}
          </li>
        ))}
        {receipts.map((r) => (
          <li key={r.id} className="truncate px-3 py-1.5 text-gray-700">
            {r.number ?? 'New Receipt'} · {r.payerName}
          </li>
        ))}
      </ul>
    </div>
  )
}
