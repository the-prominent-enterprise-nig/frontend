'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransactions, useBranches } from '../../_hooks/usePos'
import { RefreshCw, ShoppingCart, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { getOwnReleaseFormRequests } from '../../_actions/pos-actions'
import type { PosTransaction } from '@/src/schema/pos'
import { usePosBranchContext } from '@/src/stores/pos-branch-context.store'
import { PosDateTime } from '../../_components/PosDate'
import { Skeleton } from '@/src/components/ui/Skeleton'
import { type SessionUser } from '@/src/libs/guards/permission'
import { saleDocNo } from '@/src/libs/format/saleDocNo'
import Link from 'next/link'
import { XDealBadge } from '@/src/components/pos/XDealBadge'
import SearchableSelect from '@/src/components/ui/SearchableSelect'
import { INVOICE_TYPE_FILTER_OPTIONS, invoiceTypeTag } from '../_utils/invoice-type'
import {
  EMPTY_APPLY_FILTERS,
  type BranchPick,
  type ListFilters,
  type SortDir,
  initialListFilters,
  saveListFilters,
  useHydrated,
} from '../_utils/list-filters'

const typeColor: Record<string, string> = {
  sale: 'bg-blue-100 text-blue-700',
  refund: 'bg-orange-100 text-orange-700',
  exchange: 'bg-purple-100 text-purple-700',
}

const statusColor: Record<string, string> = {
  completed: 'bg-green-100 text-green-700',
  voided: 'bg-red-100 text-red-700',
}

const TYPE_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'sale', label: 'Sale' },
  { value: 'refund', label: 'Refund' },
  { value: 'exchange', label: 'Exchange' },
]

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'voided', label: 'Voided' },
]

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)
}

/** Sorts by the SI / DR No. the way a person reads it: 2 before 10, not after. */
function sortByDocNo(list: PosTransaction[], dir: SortDir): PosTransaction[] {
  if (dir === 'none') return list
  const sign = dir === 'asc' ? 1 : -1
  return [...list].sort(
    (a, b) =>
      sign *
      saleDocNo(a).localeCompare(saleDocNo(b), undefined, { numeric: true, sensitivity: 'base' })
  )
}

function nextSortDir(dir: SortDir): SortDir {
  return dir === 'none' ? 'asc' : dir === 'asc' ? 'desc' : 'none'
}

function InvoiceTypeCell({ tx }: { tx: PosTransaction }): React.JSX.Element {
  const tag = invoiceTypeTag(tx)
  return (
    <span
      data-testid="invoice-type"
      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tag.className}`}
    >
      {tag.label}
    </span>
  )
}

interface Props {
  session: SessionUser
}

/** Ticket #24 follow-up — the list comes back as this tab left it (see
 * list-filters.ts). What was left is only known in the browser, so the list
 * starts once hydrated; until then it shows the same loading state it shows
 * while fetching. */
export default function TransactionsList({ session }: Props): React.JSX.Element {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hydrated = useHydrated()
  // A link to /pos/transactions?id=<transactionId> (the POS Overview's Recent
  // Transactions, a source-document link) lands on that transaction's own
  // page now that it is no longer a modal over this list. Sent from here, on
  // the first commit: started from the list below, after hydration, the
  // navigation never went through.
  const redirectId = searchParams.get('id')
  useEffect(() => {
    if (redirectId) router.replace(`/pos/transactions/${redirectId}`)
  }, [router, redirectId])
  if (!hydrated || redirectId) return <ListLoading />
  return <TransactionsListView session={session} initial={initialListFilters(searchParams)} />
}

function ListLoading(): React.JSX.Element {
  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6" aria-label="Loading transactions">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">All sales, refunds, and exchanges.</p>
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}

function TransactionsListView({
  session,
  initial,
}: Props & { initial: ListFilters }): React.JSX.Element {
  // Scenario 59 — an installment sale held for manager release approval has
  // no PosTransaction yet: createdTransactionId is set only once the request
  // is approved. So it is correctly absent from the list below, and to the
  // cashier who just rang it up it simply vanished — nothing on this page
  // said it was waiting on anyone.
  //
  // A banner, not rows: a pending request has no transaction number and no
  // settled total, so as a table row it reads like a broken transaction
  // rather than a sale in flight. /pos/release-approvals already renders
  // these properly for the cashier who raised them (its own /own endpoint is
  // gated on pos:transactions:read, which Cashier holds) — this only tells
  // them to look.
  const [pendingReleaseCount, setPendingReleaseCount] = useState(0)
  useEffect(() => {
    let cancelled = false
    getOwnReleaseFormRequests()
      .then((res) => {
        if (cancelled || !res.success || !res.data) return
        setPendingReleaseCount(res.data.filter((r) => r.status === 'pending').length)
      })
      .catch(() => {
        // Non-blocking: this is a pointer to another page, not the page's own
        // data. A failure here must never take the transaction list with it.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const router = useRouter()
  const { branchId } = usePosBranchContext()
  // Ticket #24 — a Sales Admin Clerk reconciles several branches, but the
  // top-bar branch switcher only shows for privileged roles, so a clerk had no
  // way to narrow the list. This page-level pick starts from the shared POS
  // branch (so the switcher still works where it exists) and, unlike it,
  // changes only this list — never the branch every other POS page filters by.
  const [branchPick, setBranchPick] = useState<BranchPick | null>(initial.branchPick)
  // A pick lapses when the top-bar branch changes under it, so the switcher
  // still wins whenever someone uses it.
  const branchFilter =
    branchPick && branchPick.under === branchId ? branchPick.value : (branchId ?? '')
  const setBranchFilter = (value: string): void => setBranchPick({ under: branchId, value })
  // A branch-assigned user is always served their own branch by the backend,
  // whatever is asked for — so a picker would only pretend to filter.
  const branchPickerVisible = !session.branchId
  const branches = useBranches()
  const branchOptions = [
    { value: '', label: 'All branches' },
    ...(branches.data?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
  ]
  const [sortDir, setSortDir] = useState<SortDir>(initial.sort)

  const [filters, setFilters] = useState(initial.filters)
  const [applied, setApplied] = useState(initial.filters)
  // Scenario 23 Gap 3 — kept separate from filters/applied above: the
  // Type/Status/Date filters still wait for an explicit Apply click (you're
  // usually setting several before submitting), but a plain search box
  // should just search as you stop typing, no button needed.
  // ?search= also lets an AR Invoice "Sale: <transactionNumber>" link
  // deep-link straight into a prefilled search.
  const [search, setSearch] = useState(initial.search)
  const [debouncedSearch, setDebouncedSearch] = useState(initial.search)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400)
    return () => clearTimeout(timer)
  }, [search])
  // Remember what is in force — the applied filters, the searched text, this
  // page's own branch pick and the sort — for when the clerk comes back.
  useEffect(() => {
    saveListFilters({ search: debouncedSearch, filters: applied, branchPick, sort: sortDir })
  }, [debouncedSearch, applied, branchPick, sortDir])
  const { data, isLoading, isFetching, refetch } = useTransactions(
    Object.fromEntries(
      Object.entries({
        ...applied,
        transactionNumber: debouncedSearch,
        branchId: branchFilter,
      }).filter(([, v]) => v !== '')
    ) as Record<string, string>
  )

  const transactions = useMemo(() => sortByDocNo(data?.data ?? [], sortDir), [data?.data, sortDir])

  return (
    <div className="min-h-full bg-zinc-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="mt-1 text-sm text-gray-500">All sales, refunds, and exchanges.</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {pendingReleaseCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm text-amber-800">
              <span className="font-semibold">
                {pendingReleaseCount} sale{pendingReleaseCount === 1 ? '' : 's'}
              </span>{' '}
              waiting on manager release approval.{' '}
              {pendingReleaseCount === 1 ? 'It is' : 'They are'} not listed below until approved.
            </p>
            <Link
              href="/pos/release-approvals"
              className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              View
            </Link>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="min-w-36 flex-1">
            {/* Scenario 23 Gap 3 — unified search: matches the Sales
                Invoice No., the transaction number, OR any AR invoice
                number the sale produced, so staff starting from a sales
                invoice, a receipt's transaction #, or a bank memo's
                invoice # all land on the same transaction. */}
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              SI / DR No. or Invoice #
            </label>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                className="input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {/* Type, Invoice Type, Branch and Status are the same searchable picker,
              sized so the filters, Apply and Clear sit on one row as in the
              mockup. Like the dates, all but Branch wait for Apply. */}
          <div className="w-28">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Type</label>
            <SearchableSelect
              value={filters.transactionType}
              onChange={(v) => setFilters((p) => ({ ...p, transactionType: v }))}
              options={TYPE_FILTER_OPTIONS}
              placeholder="All"
              ariaLabel="Type"
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Invoice Type</label>
            <SearchableSelect
              value={filters.invoiceType}
              onChange={(v) => setFilters((p) => ({ ...p, invoiceType: v }))}
              options={[{ value: '', label: 'All' }, ...INVOICE_TYPE_FILTER_OPTIONS]}
              placeholder="All"
              ariaLabel="Invoice Type"
            />
          </div>
          {branchPickerVisible && (
            <div className="w-36">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Branch</label>
              <SearchableSelect
                value={branchFilter}
                onChange={(v) => setBranchFilter(v)}
                options={branchOptions}
                placeholder="All branches"
                loading={branches.isLoading}
                ariaLabel="Branch"
              />
            </div>
          )}
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
            <SearchableSelect
              value={filters.status}
              onChange={(v) => setFilters((p) => ({ ...p, status: v }))}
              options={STATUS_FILTER_OPTIONS}
              placeholder="All"
              ariaLabel="Status"
            />
          </div>
          <div className="w-[10.5rem]">
            <label className="mb-1 block text-xs font-semibold text-gray-600">From</label>
            <input
              className="input px-2"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
            />
          </div>
          <div className="w-[10.5rem]">
            <label className="mb-1 block text-xs font-semibold text-gray-600">To</label>
            <input
              className="input px-2"
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
            />
          </div>
          <button
            onClick={() => setApplied(filters)}
            className="rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
          >
            Apply
          </button>
          <button
            onClick={() => {
              setFilters(EMPTY_APPLY_FILTERS)
              setApplied(EMPTY_APPLY_FILTERS)
              setSearch('')
              setDebouncedSearch('')
              setBranchFilter('')
              setSortDir('none')
            }}
            className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100"
          >
            Clear
          </button>
        </div>

        {!isLoading && transactions.length > 0 && (
          <p className="text-xs text-gray-500">
            Showing <span className="font-semibold text-gray-700">{transactions.length}</span>{' '}
            transaction{transactions.length !== 1 ? 's' : ''}
          </p>
        )}

        <div
          className={`scroll-fade-x overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity ${
            isFetching && !isLoading ? 'opacity-60' : ''
          }`}
        >
          {isLoading ? (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    SI / DR No.
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Invoice Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-24 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </td>
                    <td className="px-5 py-3">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-400">
              <ShoppingCart size={40} />
              <p className="text-sm">No transactions found.</p>
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th
                    className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500"
                    aria-sort={
                      sortDir === 'asc' ? 'ascending' : sortDir === 'desc' ? 'descending' : 'none'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSortDir(nextSortDir(sortDir))}
                      title="Sort by SI / DR No."
                      className="inline-flex items-center gap-1 font-semibold uppercase hover:text-gray-800"
                    >
                      SI / DR No.
                      {sortDir === 'asc' ? (
                        <ArrowUp size={12} />
                      ) : sortDir === 'desc' ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="text-gray-300" />
                      )}
                    </button>
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Invoice Type
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Branch
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Status
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase text-gray-500">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => router.push(`/pos/transactions/${tx.id}`)}
                  >
                    {/* The Sales Invoice No. is what staff have in hand;
                        older sales and refunds carry none, so those fall
                        back to the internal transaction number. */}
                    <td className="px-5 py-3 font-mono text-sm font-medium text-gray-800">
                      {/* A real link, so the clerk can open it in a new tab; the
                          row itself is clickable too. */}
                      <Link
                        href={`/pos/transactions/${tx.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-purple-700 hover:underline"
                      >
                        {saleDocNo(tx)}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeColor[tx.transactionType]}`}
                        >
                          {tx.transactionType}
                        </span>
                        {tx.isXDeal && <XDealBadge reference={tx.xDealReference} />}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <InvoiceTypeCell tx={tx} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {tx.session?.terminal?.branch?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[tx.status]}`}
                      >
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      <PosDateTime iso={tx.occurredAt ?? tx.createdAt} />
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatCurrency(tx.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
