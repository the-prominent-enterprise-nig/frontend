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
  type BankAccountOption,
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
  /** A Deposited row's deposit has its slip attached. Null when there is no
   * deposit record to attach one to, or the row is not deposited. */
  hasProof: boolean | null
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
            hasProof: null,
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
        hasProof: null,
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
    hasProof: null,
  }
}

function fromDeposited(r: CashInTransitHistoryRow): LedgerRow {
  const collected = amounts(r.amount, r.clearingAmount, r.newReceiptsAmount)
  return {
    key: `${r.sessionId}:deposited`,
    sessionId: r.sessionId,
    ...groupOfSession(r),
    terminalCode: r.terminalCode,
    cashierName: r.cashierName,
    closedAt: r.closedAt,
    ...collected,
    // What the bank slips cleared of it — the collected amount for a session
    // banked before deposits kept shares, or on an older API.
    deposited: r.depositedAmount ?? collected.amount,
    status: 'deposited',
    depositId: r.posDepositId,
    bankedDepositId: null,
    bankName: r.depositedTo,
    depositDate: r.depositDate ?? r.citClearedAt,
    hasProof: r.posDepositId ? (r.hasProof ?? null) : null,
  }
}

/** A To-deposit session a short deposit already banked some of. */
const isPartial = (r: LedgerRow): boolean => r.status === 'to_deposit' && r.deposited > 0

function statusText(r: LedgerRow): string {
  return isPartial(r) ? 'Partially deposited' : STATUS_TEXT[r.status]
}

/** What a row has already banked: what the slips cleared of a Deposited
 * session, and what earlier deposits took of one still To deposit. A draft
 * has posted nothing. */
function depositedOf(r: LedgerRow): number {
  return r.status === 'awaiting' ? 0 : r.deposited
}

/** What the row's session collected. A To-deposit row's amount is only what
 * is left, so what earlier deposits took is added back. */
function collectedOf(r: LedgerRow): number {
  return r.status === 'to_deposit' ? round2(r.amount + r.deposited) : r.amount
}

/** A New Receipt's whole amount: its `amount` is what is left of it. */
function receiptCollected(r: AcknowledgementReceipt): number {
  return round2(Number(r.amount ?? 0) + Number(r.depositedAmount ?? 0))
}

/** What a row adds to the balance: collected less deposited. Over, it is a
 * negative. */
function undepositedOf(r: LedgerRow): number {
  return round2(collectedOf(r) - depositedOf(r))
}

/** A branch's rows oldest first, each with the branch's undeposited balance
 * after it. New Receipts with no session to ride on come last: still owed. */
function withRunningBalance(group: BranchGroup): {
  rows: { row: LedgerRow; balance: number }[]
  receipts: { receipt: AcknowledgementReceipt; balance: number }[]
  balance: number
} {
  let balance = 0
  const rows: { row: LedgerRow; balance: number }[] = []
  for (const row of [...group.rows].sort((a, b) => a.closedAt.localeCompare(b.closedAt))) {
    balance = round2(balance + undepositedOf(row))
    rows.push({ row, balance })
  }
  const receipts: { receipt: AcknowledgementReceipt; balance: number }[] = []
  for (const receipt of group.receipts) {
    balance = round2(balance + Number(receipt.amount ?? 0))
    receipts.push({ receipt, balance })
  }
  return { rows, receipts, balance }
}

/** A money cell that reads "—" for nothing, so the eye finds the real figures. */
function MoneyOrDash({ amount }: { amount: number }): React.JSX.Element {
  return amount > 0.005 ? <>{fmtMoney(amount)}</> : <span className="text-gray-400">—</span>
}

const STATUS_TEXT: Record<LedgerStatus, string> = {
  to_deposit: 'Undeposited',
  awaiting: 'Awaiting clearing',
  deposited: 'Deposited',
}

function exportLedgerCsv(groups: BranchGroup[]): void {
  const headers = [
    'Branch',
    'Terminal',
    'Cashier',
    'Closed At',
    'Status',
    'Bank',
    'Deposit Date',
    'Collected',
    'Deposited',
    'Balance',
  ]
  const dataRows = groups.flatMap((group) => {
    const ledger = withRunningBalance(group)
    return [
      ...ledger.rows.map(({ row: r, balance }) => [
        r.branchName,
        r.terminalCode ?? '',
        r.cashierName ?? '',
        fmtDate(r.closedAt),
        statusText(r),
        r.bankName ?? '',
        r.depositDate ? fmtDate(r.depositDate) : '',
        collectedOf(r),
        depositedOf(r),
        balance,
      ]),
      ...ledger.receipts.map(({ receipt: r, balance }) => [
        group.branchName,
        r.number ?? 'New Receipt',
        r.payerName ?? '',
        fmtDate(r.paymentDate),
        STATUS_TEXT.to_deposit,
        '',
        '',
        receiptCollected(r),
        Number(r.depositedAmount ?? 0),
        balance,
      ]),
    ]
  })
  const csv = [headers, ...dataRows].map((row) => row.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `collected-funds-history-${new Date().toISOString().slice(0, 10)}.csv`
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
  title = 'Collected Funds History',
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
  const groups = groupByBranch(shown, shownReceipts)
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
    // Full width: nine columns, a branch header row each, and a Balance.
    <div className="w-full p-4 md:p-6">
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
            onClick={() => exportLedgerCsv(groups)}
            disabled={groups.length === 0}
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
        groups={groups}
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
    queryFn: () => BankAccounts.options(),
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

/** Head Office and the owner choose a branch, or all of them — by name only;
 * the table's Balance says what each still has to bank. */
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
      label: b.branchName,
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
    ['to_deposit', `${STATUS_TEXT.to_deposit} (${props.counts.to_deposit})`],
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
    // No horizontal scroll: the page is full width, so the columns fit and
    // cells wrap on a narrow screen instead.
    <div className="rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-600">
          <tr>
            {canManage && <th className="w-10 px-3 py-2" />}
            <th className="px-3 py-2 text-left">Session</th>
            <th className="px-3 py-2 text-left">Closed</th>
            <th className="px-3 py-2 text-left">Deposit date</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">Collected</th>
            <th className="px-3 py-2 text-right">Deposited</th>
            <th className="px-3 py-2 text-right">
              <Tooltip
                label="What the branch still has undeposited, oldest session first"
                align="end"
              >
                <span>Balance</span>
              </Tooltip>
            </th>
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
  const ledger = withRunningBalance(group)
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
        <td colSpan={columns - (canManage ? 4 : 3)} className="px-3 py-2">
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
          {fmtMoney(
            group.rows.reduce((sum, r) => sum + collectedOf(r), 0) +
              group.receipts.reduce((sum, r) => sum + receiptCollected(r), 0)
          )}
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">
          <MoneyOrDash amount={group.rows.reduce((sum, r) => sum + depositedOf(r), 0)} />
        </td>
        <td className="px-3 py-2 text-right font-semibold tabular-nums">
          {fmtMoney(ledger.balance)}
        </td>
      </tr>
      {open &&
        ledger.rows.map(({ row, balance }) => (
          <SessionRow
            key={row.key}
            row={row}
            balance={balance}
            canManage={canManage}
            selection={selection}
            onOpenDeposit={onOpenDeposit}
          />
        ))}
      {open &&
        ledger.receipts.map(({ receipt, balance }) => (
          <ReceiptRow key={receipt.id} receipt={receipt} balance={balance} canManage={canManage} />
        ))}
    </tbody>
  )
}

/** The terminal (or New Receipt number) over the cashier (or payer) — one
 * column for both, so the table fits the page without scrolling. */
function SessionCell({
  title,
  detail,
}: {
  title: string
  detail?: string | null
}): React.JSX.Element {
  return (
    <>
      <div>{title}</div>
      {detail && <div className="text-xs text-gray-500">{detail}</div>}
    </>
  )
}

/** An unbanked New Receipt the branch has no To-deposit session for. Not
 * tickable: recording the branch's deposit takes it in automatically. */
function ReceiptRow({
  receipt,
  balance,
  canManage,
}: {
  receipt: AcknowledgementReceipt
  /** The branch's undeposited balance after this row. */
  balance: number
  canManage: boolean
}): React.JSX.Element {
  return (
    <tr>
      {canManage && <td className="px-3 py-2" />}
      <td className="px-3 py-2">
        <SessionCell title={receipt.number ?? 'New Receipt'} detail={receipt.payerName} />
      </td>
      <td className="px-3 py-2 text-xs">{fmtDate(receipt.paymentDate)}</td>
      <td className="px-3 py-2 text-xs text-gray-400">—</td>
      <td className="px-3 py-2">
        {Number(receipt.depositedAmount ?? 0) > 0 ? (
          <PartialChip banked={Number(receipt.depositedAmount)} />
        ) : (
          <span className="text-xs text-gray-500">Undeposited · New Receipt</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(receiptCollected(receipt))}</td>
      <td className="px-3 py-2 text-right">
        <MoneyOrDash amount={Number(receipt.depositedAmount ?? 0)} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(balance)}</td>
    </tr>
  )
}

/** A To-deposit row ticks; any other row opens the deposit it is in. A
 * Partially deposited one opens the deposit that banked part of it — from the
 * row for whoever cannot tick it, from its chip for whoever can. */
function SessionRow({
  row,
  balance,
  canManage,
  selection,
  onOpenDeposit,
}: {
  row: LedgerRow
  /** The branch's undeposited balance after this row. */
  balance: number
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
      <td className="px-3 py-2">
        <SessionCell title={row.terminalCode ?? '—'} detail={row.cashierName} />
      </td>
      <td className="px-3 py-2 text-xs">{fmtDate(row.closedAt)}</td>
      <td className="px-3 py-2 text-xs">
        {row.depositDate ? fmtDate(row.depositDate) : <span className="text-gray-400">—</span>}
      </td>
      <td className="px-3 py-2">
        <StatusCell row={row} canManage={canManage} onOpenDeposit={onOpenDeposit} />
      </td>
      <td className="px-3 py-2 text-right">{fmtMoney(collectedOf(row))}</td>
      <td className="px-3 py-2 text-right tabular-nums">
        <MoneyOrDash amount={depositedOf(row)} />
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(balance)}</td>
    </tr>
  )
}

/** To deposit, Awaiting or Deposited — the status only; the date has its own
 * column. No bank: a deposit goes to several, one per slip, and the stored
 * one is only the first slip's. */
function StatusCell({
  row,
  canManage,
  onOpenDeposit,
}: {
  row: LedgerRow
  /** The cashier, who attaches a deposit's slip — shown which still lack one. */
  canManage: boolean
  onOpenDeposit: (id: string) => void
}): React.JSX.Element {
  // Still To deposit (it filters and ticks as one), but a short deposit
  // banked some of it: the amount is what is left.
  if (isPartial(row)) {
    const id = row.bankedDepositId
    return <PartialChip banked={row.deposited} onOpen={id ? () => onOpenDeposit(id) : undefined} />
  }
  if (row.status === 'to_deposit') {
    return <span className="text-xs text-gray-500">{STATUS_TEXT.to_deposit}</span>
  }
  if (row.status === 'deposited') {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-800">
          Deposited
        </span>
        {canManage && row.hasProof === false && (
          <Tooltip label="No deposit slip attached yet. Open the deposit to attach it." align="end">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
              No slip
            </span>
          </Tooltip>
        )}
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
    'rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800'
  const left = `${fmtMoney(banked)} already deposited — the Balance shows what is left`
  return (
    <Tooltip label={onOpen ? `${left}. Click to open that deposit.` : left} align="end">
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
  accounts: BankAccountOption[]
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

  const owed = owedTotals(sessions, receipts)
  const entered = slipTotals(slips)
  const difference = round2(owed.cash - entered.cash)
  // Why Record deposit is disabled, so the button never just sits greyed out.
  const blockedReason =
    sessions.length === 0 && receipts.length === 0
      ? 'Select at least one session to deposit.'
      : (slipsProblem(slips) ?? clearingOverProblem(owed, entered))
  // Not a block: the amounts are accounting's own itemisation. Said on hover
  // so an over or short is a choice, not a typo nobody saw.
  const cashNote =
    Math.abs(difference) >= 0.005
      ? difference > 0
        ? `Cash & cheques: ${fmtMoney(difference)} left — entered ${fmtMoney(entered.cash)} of ${fmtMoney(owed.cash)}.`
        : `Cash & cheques: over by ${fmtMoney(-difference)} — entered ${fmtMoney(entered.cash)} of ${fmtMoney(owed.cash)}.`
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

            {(sessions.length > 0 || receipts.length > 0) && (
              <DepositTally owed={owed} entered={entered} slips={slips} accounts={accounts} />
            )}

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

/** What a deposit has to bank, by where the money sits: the branch's own cash
 * and cheques (sessions and New Receipts), and card and e-wallet money in the
 * processors' clearing accounts. */
interface DepositOwedTotals {
  cash: number
  clearing: number
}

function owedTotals(sessions: LedgerRow[], receipts: AcknowledgementReceipt[]): DepositOwedTotals {
  return {
    cash: round2(
      sessions.reduce((sum, s) => sum + s.cash, 0) +
        receipts.reduce((sum, r) => sum + Number(r.amount ?? 0), 0)
    ),
    clearing: round2(sessions.reduce((sum, s) => sum + s.clearing, 0)),
  }
}

/**
 * A block, unlike a short: slips emptying the clearing accounts of more than
 * these sessions put there are almost always drawer cash given the wrong
 * Deposit from. Posted, it overdraws the processor's clearing account and
 * leaves the cash owed, for accounting to correct.
 */
function clearingOverProblem(owed: DepositOwedTotals, entered: DepositOwedTotals): string | null {
  const over = round2(entered.clearing - owed.clearing)
  if (over < 0.005) return null
  return owed.clearing < 0.005
    ? `These sessions have no card or e-wallet money, but ${fmtMoney(entered.clearing)} is set to Deposit from a 1-01-040 clearing account. Cash goes under 1-01-010.`
    : `1-01-040 clearing slips are over by ${fmtMoney(over)} — these sessions only have ${fmtMoney(owed.clearing)} in card and e-wallet. Is a cash slip set to the wrong Deposit from?`
}

/** The slips' amounts against the same two pools. A slip not yet told what
 * it empties counts in neither. */
function slipTotals(slips: Slip[]): DepositOwedTotals {
  const sum = (picked: Slip[]): number => round2(picked.reduce((t, s) => t + slipAmount(s), 0))
  return {
    cash: sum(slips.filter(isBranchCashSlip)),
    clearing: sum(slips.filter((s) => !!s.clearsAccountId)),
  }
}

/**
 * Which sessions and New Receipts are being banked, and what each one comes
 * to. The slips' amounts still start blank (Scenario 70 G12) — accounting
 * itemises each bank — but against a figure they can see.
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
  const owed = owedTotals(sessions, receipts)
  // One line's amount would only repeat the total below it.
  const itemised = sessions.length + receipts.length > 1
  return (
    <div className="rounded-lg border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900">
        {branchName} · {plural(sessions.length, 'session')}
        {receipts.length > 0 && ` · ${plural(receipts.length, 'New Receipt')}`}
      </div>
      <ul className="max-h-40 divide-y divide-gray-100 overflow-y-auto text-sm">
        {sessions.map((s) => (
          <OwedLine
            key={s.sessionId}
            label={`${s.terminalCode ?? 'Terminal'} · ${s.cashierName ?? 'Cashier'} · closed ${fmtDate(s.closedAt)}`}
            amount={itemised ? s.cash + s.clearing : undefined}
          />
        ))}
        {receipts.map((r) => (
          <OwedLine
            key={r.id}
            label={`${r.number ?? 'New Receipt'} · ${r.payerName}`}
            amount={itemised ? Number(r.amount ?? 0) : undefined}
          />
        ))}
      </ul>
      {/* The cash / card split is the tally's, under the slips. */}
      <div className="flex justify-end border-t border-gray-200 px-3 py-2 text-sm">
        <span className="font-medium text-gray-900">
          To deposit <strong className="tabular-nums">{fmtMoney(owed.cash + owed.clearing)}</strong>
        </span>
      </div>
    </div>
  )
}

function OwedLine({ label, amount }: { label: string; amount?: number }): React.JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-1.5 text-gray-700">
      <span className="truncate">{label}</span>
      {amount !== undefined && <span className="shrink-0 tabular-nums">{fmtMoney(amount)}</span>}
    </li>
  )
}

interface TallyLine {
  /** Named as the slip's Deposit from dropdown groups it. */
  label: string
  due: number
  entered: number
  slips: Slip[]
  /** Over is a block here, not a warning — see clearingOverProblem. */
  overBlocks?: boolean
}

/** The slips so far against what is to deposit, a line per Deposit from group
 * — live, with the slips counted on each, so it is plain which slip went
 * where. A tally, not a block: the amounts are accounting's own itemisation. */
function DepositTally({
  owed,
  entered,
  slips,
  accounts,
}: {
  owed: DepositOwedTotals
  entered: DepositOwedTotals
  slips: Slip[]
  accounts: BankAccountOption[]
}): React.JSX.Element {
  const lines: TallyLine[] = [
    {
      label: '1-01-010 Cash and Cash Equivalents',
      due: owed.cash,
      entered: entered.cash,
      slips: slips.filter(isBranchCashSlip),
    },
  ]
  if (owed.clearing > 0.005 || entered.clearing > 0.005) {
    lines.push({
      label: '1-01-040 Clearing Funds',
      due: owed.clearing,
      entered: entered.clearing,
      slips: slips.filter((s) => !!s.clearsAccountId),
      overBlocks: true,
    })
  }
  return (
    <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
      {lines.map((line) => (
        <div key={line.label} className="px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-gray-800">{line.label}</span>
            <span className="flex items-center gap-3 tabular-nums">
              <span className="text-gray-500">
                {fmtMoney(line.entered)} / {fmtMoney(line.due)}
              </span>
              <DifferenceChip
                difference={round2(line.due - line.entered)}
                overBlocks={line.overBlocks}
              />
            </span>
          </div>
          <SlipNames slips={line.slips} accounts={accounts} />
        </div>
      ))}
    </div>
  )
}

/** The slips counted on a tally line, by bank and amount. */
function SlipNames({
  slips,
  accounts,
}: {
  slips: Slip[]
  accounts: BankAccountOption[]
}): React.JSX.Element {
  const counted = slips.filter((s) => slipAmount(s) > 0)
  const bankName = (id: string): string => accounts.find((a) => a.id === id)?.name ?? 'No bank'
  return (
    <p className="mt-0.5 text-xs text-gray-500">
      {counted.length
        ? counted.map((s) => `${bankName(s.bankAccountId)} ${fmtMoney(slipAmount(s))}`).join(' · ')
        : 'No slips yet'}
    </p>
  )
}

function DifferenceChip({
  difference,
  overBlocks = false,
}: {
  difference: number
  overBlocks?: boolean
}): React.JSX.Element {
  if (Math.abs(difference) < 0.005) {
    // This line only — "Complete" read as the whole deposit being done.
    return <span className="font-medium text-green-700">Matches</span>
  }
  const tone = overBlocks && difference < 0 ? 'text-red-700' : 'text-amber-700'
  return (
    <span className={`font-medium ${tone}`}>
      {difference > 0
        ? `${fmtMoney(difference)} left`
        : `Over by ${fmtMoney(Math.abs(difference))}`}
    </span>
  )
}
